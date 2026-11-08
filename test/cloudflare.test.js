'use strict'

const assert = require('node:assert/strict')
const { afterEach, beforeEach, describe, it } = require('node:test')
const { MockAgent, getGlobalDispatcher, setGlobalDispatcher } = require('undici')
const { applyCloudflareSettings } = require('../index')

describe('@nodeart/cloudflare-provisioning', () => {
  let originalDispatcher
  let mockAgent
  let pool
  let originalEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
    process.env.CLOUDFLARE_TOKEN = 'test-token'
    process.env.DELAY_MS = '0'

    originalDispatcher = getGlobalDispatcher()
    mockAgent = new MockAgent()
    mockAgent.disableNetConnect()
    setGlobalDispatcher(mockAgent)
    pool = mockAgent.get('https://api.cloudflare.com')
  })

  afterEach(async () => {
    mockAgent.assertNoPendingInterceptors()
    process.env = originalEnv
    setGlobalDispatcher(originalDispatcher)
    await mockAgent.close()
  })

  it('applies new zone settings and managedHeaders with $DOMAIN substitution', async () => {
    const received = []

    const interceptPatch = (endpoint) => {
      pool.intercept({
        path: `/client/v4/zones/zone-1/${endpoint}`,
        method: 'PATCH'
      }).reply(200, (opts) => {
        received.push({ endpoint, body: JSON.parse(opts.body) })
        return { success: true, result: {} }
      }, { headers: { 'content-type': 'application/json' } })
    }

    interceptPatch('settings/always_use_https')
    interceptPatch('settings/min_tls_version')
    interceptPatch('settings/tls_1_3')
    interceptPatch('settings/security_header')
    interceptPatch('settings/ip_geolocation')
    interceptPatch('settings/websockets')
    interceptPatch('settings/browser_cache_ttl')
    interceptPatch('managed_headers')

    await applyCloudflareSettings({
      enabled: true,
      domains: [{ domain: 'example.com', zoneId: 'zone-1' }],
      settings: {
        alwaysUseHttps: 'on',
        minTlsVersion: '1.1',
        tls13: 'zrt',
        securityHeader: {
          strict_transport_security: {
            enabled: true,
            max_age: 31536000,
            include_subdomains: true,
            preload: true,
            nosniff: true
          }
        },
        ipGeolocation: 'on',
        websockets: 'off',
        browserCacheTtl: 0,
        managedHeaders: {
          managed_request_headers: [{ id: 'add_visitor_location_headers', enabled: true }],
          managed_response_headers: [{ id: 'remove_x-powered-by_header', enabled: true }]
        }
      }
    })

    assert.deepEqual(received, [
      { endpoint: 'settings/always_use_https', body: { value: 'on' } },
      { endpoint: 'settings/min_tls_version', body: { value: '1.1' } },
      { endpoint: 'settings/tls_1_3', body: { value: 'zrt' } },
      {
        endpoint: 'settings/security_header',
        body: {
          value: {
            strict_transport_security: {
              enabled: true,
              max_age: 31536000,
              include_subdomains: true,
              preload: true,
              nosniff: true
            }
          }
        }
      },
      { endpoint: 'settings/ip_geolocation', body: { value: 'on' } },
      { endpoint: 'settings/websockets', body: { value: 'off' } },
      { endpoint: 'settings/browser_cache_ttl', body: { value: 0 } },
      {
        endpoint: 'managed_headers',
        body: {
          managed_request_headers: [{ id: 'add_visitor_location_headers', enabled: true }],
          managed_response_headers: [{ id: 'remove_x-powered-by_header', enabled: true }]
        }
      }
    ])
  })

  it('paginates DNS records, deletes conflicting A/AAAA records while preserving apex MX/TXT, and creates CNAMEs', async () => {
    const operations = []

    pool.intercept({
      path: '/client/v4/zones/zone-1/dns_records?per_page=100&page=1',
      method: 'GET'
    }).reply(200, {
      success: true,
      result: [
        { id: 'apex-a', type: 'A', name: 'example.com', content: '192.0.2.1' },
        { id: 'apex-aaaa', type: 'AAAA', name: 'example.com', content: '2001:db8::1' },
        { id: 'apex-mx', type: 'MX', name: 'example.com', content: 'mail.example.com' }
      ],
      result_info: { page: 1, total_pages: 2 }
    })

    pool.intercept({
      path: '/client/v4/zones/zone-1/dns_records?per_page=100&page=2',
      method: 'GET'
    }).reply(200, {
      success: true,
      result: [
        { id: 'apex-txt', type: 'TXT', name: 'example.com', content: 'v=spf1 ~all' },
        { id: 'www-a', type: 'A', name: 'www.example.com', content: '192.0.2.2' },
        { id: 'www-txt', type: 'TXT', name: 'www.example.com', content: 'parking' }
      ],
      result_info: { page: 2, total_pages: 2 }
    })

    for (const deletedId of ['www-a', 'www-txt', 'apex-a', 'apex-aaaa']) {
      pool.intercept({
        path: `/client/v4/zones/zone-1/dns_records/${deletedId}`,
        method: 'DELETE'
      }).reply(200, () => {
        operations.push({ op: 'delete', id: deletedId })
        return { success: true, result: { id: deletedId } }
      })
    }

    pool.intercept({
      path: '/client/v4/zones/zone-1/dns_records',
      method: 'POST'
    }).reply(200, (opts) => {
      const payload = JSON.parse(opts.body)
      operations.push({ op: 'create', payload })
      return { success: true, result: { id: `new-${payload.name}`, ...payload } }
    }).times(2)

    await applyCloudflareSettings({
      enabled: true,
      domains: [{ domain: 'example.com', zoneId: 'zone-1' }],
      settings: {
        dnsRecords: [
          { type: 'CNAME', name: 'www', content: '$DOMAIN', proxied: true },
          { type: 'CNAME', name: '@', content: 'www.$DOMAIN', proxied: true }
        ]
      }
    })

    assert.deepEqual(operations, [
      { op: 'delete', id: 'www-a' },
      { op: 'delete', id: 'www-txt' },
      {
        op: 'create',
        payload: { type: 'CNAME', name: 'www.example.com', content: 'example.com', proxied: true }
      },
      { op: 'delete', id: 'apex-a' },
      { op: 'delete', id: 'apex-aaaa' },
      {
        op: 'create',
        payload: { type: 'CNAME', name: 'example.com', content: 'www.example.com', proxied: true }
      }
    ])
  })

  it('preserves matching multi-A records instead of overwriting a later desired IP', async () => {
    const operations = []

    pool.intercept({
      path: '/client/v4/zones/zone-1/dns_records?per_page=100&page=1',
      method: 'GET'
    }).reply(200, {
      success: true,
      result: [
        { id: 'rec-85', type: 'A', name: 'l.example.com', content: '51.68.184.85', proxied: true }
      ],
      result_info: { page: 1, total_pages: 1 }
    })

    pool.intercept({
      path: '/client/v4/zones/zone-1/dns_records',
      method: 'POST'
    }).reply(200, (opts) => {
      const payload = JSON.parse(opts.body)
      operations.push({ op: 'create', payload })
      return { success: true, result: { id: 'rec-84', ...payload } }
    })

    pool.intercept({
      path: '/client/v4/zones/zone-1/dns_records/rec-85',
      method: 'PATCH'
    }).reply(200, (opts) => {
      const payload = JSON.parse(opts.body)
      operations.push({ op: 'update', id: 'rec-85', payload })
      return { success: true, result: { id: 'rec-85', ...payload } }
    })

    await applyCloudflareSettings({
      enabled: true,
      domains: [{ domain: 'example.com', zoneId: 'zone-1' }],
      settings: {
        dnsRecords: [
          { type: 'A', name: 'l.$DOMAIN', content: '51.68.184.84', proxied: true },
          { type: 'A', name: 'l.$DOMAIN', content: '51.68.184.85', proxied: true }
        ]
      }
    })

    assert.deepEqual(operations, [
      {
        op: 'create',
        payload: { type: 'A', name: 'l.example.com', content: '51.68.184.84', proxied: true }
      },
      {
        op: 'update',
        id: 'rec-85',
        payload: { type: 'A', name: 'l.example.com', content: '51.68.184.85', proxied: true }
      }
    ])
  })

  it('propagates API and unsupported-setting failures via AggregateError', async () => {
    pool.intercept({
      path: '/client/v4/zones/zone-1/managed_headers',
      method: 'PATCH'
    }).reply(403, { success: false, errors: [{ message: 'request is not authorized' }] })

    pool.intercept({
      path: '/client/v4/zones/zone-1/pagerules',
      method: 'GET'
    }).reply(200, { success: true, result: [] })

    pool.intercept({
      path: '/client/v4/zones/zone-1/pagerules',
      method: 'POST'
    }).reply(403, { success: false, errors: [{ code: 9109, message: 'Unauthorized' }] })

    pool.intercept({
      path: '/client/v4/zones/zone-1/workers/routes',
      method: 'GET'
    }).reply(200, { success: true, result: [{ id: 'route-1', pattern: '*example.com/*' }] })

    pool.intercept({
      path: '/client/v4/zones/zone-1/workers/routes/route-1',
      method: 'DELETE'
    }).reply(403, { success: false, errors: [{ message: 'Forbidden' }] })

    await assert.rejects(
      () => applyCloudflareSettings({
        enabled: true,
        domains: [{ domain: 'example.com', zoneId: 'zone-1' }],
        settings: {
          managedHeaders: { managed_request_headers: [] },
          pageRules: [{ targets: [{ target: 'url', constraint: { operator: 'matches', value: '*$DOMAIN/*' } }], actions: [] }],
          workers: [{ pattern: '*$DOMAIN/*', script: 'worker-a' }],
          toString: 'invalid'
        }
      }),
      (err) => {
        assert.ok(err instanceof AggregateError)
        assert.equal(err.errors.length, 4)
        assert.match(err.errors[0].message, /Could not set managed headers: 403/)
        assert.match(err.errors[1].message, /Could not update 1 page rule\(s\)/)
        assert.match(err.errors[2].message, /Could not delete 1 worker route\(s\)/)
        assert.match(err.errors[3].message, /Unsupported Cloudflare setting: toString/)
        return true
      }
    )
  })

  it('skips API calls when config.enabled is false', async () => {
    await applyCloudflareSettings({
      enabled: false,
      domains: [{ domain: 'example.com', zoneId: 'zone-1' }],
      settings: {
        ssl: 'full'
      }
    })
  })
})
