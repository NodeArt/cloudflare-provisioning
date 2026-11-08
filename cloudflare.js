'use strict'

const fs = require('node:fs/promises')
const { request } = require('undici')

const CLOUDFLARE_API_URL = 'https://api.cloudflare.com/client/v4/'

class CloudFlare {
  constructor (zoneId, domain, options, requestDelay = 0) {
    this.zoneId = zoneId
    this.domain = domain
    this.requestDelay = requestDelay

    this.authorizationHeaders = null
    if (options.email !== undefined && options.apiKey !== undefined) {
      this.authorizationHeaders = {
        'X-Auth-Email': options.email,
        'X-Auth-Key': options.apiKey
      }
    } else if (options.token !== undefined) {
      this.authorizationHeaders = {
        authorization: 'Bearer ' + options.token
      }
    } else {
      throw new Error('You must provide either an email and api key or a token')
    }
  }

  async setIPv6 (value) {
    const url = CLOUDFLARE_API_URL + `zones/${this.zoneId}/settings/ipv6`

    const { statusCode, body } = await this.requestWithDelay(url, {
      method: 'PATCH',
      headers: {
        ...this.authorizationHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ value })
    })

    const response = await body.json()

    if (statusCode !== 200) {
      throw new Error(`Could not change IPv6: ${statusCode}, error: ${JSON.stringify(response)}`)
    }

    return response
  }

  async setEmailObfuscation (value) {
    const url = CLOUDFLARE_API_URL + `zones/${this.zoneId}/settings/email_obfuscation`

    const { statusCode, body } = await this.requestWithDelay(url, {
      method: 'PATCH',
      headers: {
        ...this.authorizationHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ value })
    })

    const response = await body.json()

    if (statusCode !== 200) {
      throw new Error(`Could not change email obfuscation: ${statusCode}, error: ${JSON.stringify(response)}`)
    }

    return response
  }

  async setSSL (value) {
    const url = CLOUDFLARE_API_URL + `zones/${this.zoneId}/settings/ssl`

    const { statusCode, body } = await this.requestWithDelay(url, {
      method: 'PATCH',
      headers: {
        ...this.authorizationHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ value })
    })

    const response = await body.json()

    if (statusCode !== 200) {
      throw new Error(`Could not change SSL: ${statusCode}, error: ${JSON.stringify(response)}`)
    }

    return response
  }

  async setBrotli (value) {
    const url = CLOUDFLARE_API_URL + `zones/${this.zoneId}/settings/brotli`

    const { statusCode, body } = await this.requestWithDelay(url, {
      method: 'PATCH',
      headers: {
        ...this.authorizationHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ value })
    })

    const response = await body.json()

    if (statusCode !== 200) {
      throw new Error(`Could not change brotli: ${statusCode}, error: ${JSON.stringify(response)}`)
    }

    return response
  }

  async parseResponseBody (body) {
    const raw = await body.text()
    try {
      return JSON.parse(raw)
    } catch {
      return raw
    }
  }

  async setZoneSetting (settingId, value, label = settingId) {
    const url = CLOUDFLARE_API_URL + `zones/${this.zoneId}/settings/${settingId}`

    const { statusCode, body } = await this.requestWithDelay(url, {
      method: 'PATCH',
      headers: {
        ...this.authorizationHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ value })
    })

    const response = await this.parseResponseBody(body)

    if (statusCode !== 200 || typeof response !== 'object' || response === null || response.success === false) {
      throw new Error(`Could not set ${label}: ${statusCode}, error: ${JSON.stringify(response)}`)
    }

    return response
  }

  async setAlwaysUseHttps (value) {
    return this.setZoneSetting('always_use_https', value, 'always_use_https')
  }

  async setBrowserCacheTtl (value) {
    return this.setZoneSetting('browser_cache_ttl', value, 'browser_cache_ttl')
  }

  async setIpGeolocation (value) {
    return this.setZoneSetting('ip_geolocation', value, 'ip_geolocation')
  }

  async setMinTlsVersion (value) {
    return this.setZoneSetting('min_tls_version', value, 'min_tls_version')
  }

  async setSecurityHeader (value) {
    return this.setZoneSetting('security_header', value, 'security_header')
  }

  async setTls13 (value) {
    return this.setZoneSetting('tls_1_3', value, 'tls_1_3')
  }

  async setWebsockets (value) {
    return this.setZoneSetting('websockets', value, 'websockets')
  }

  async setManagedHeaders (value) {
    const url = CLOUDFLARE_API_URL + `zones/${this.zoneId}/managed_headers`

    const { statusCode, body } = await this.requestWithDelay(url, {
      method: 'PATCH',
      headers: {
        ...this.authorizationHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(value)
    })

    const response = await this.parseResponseBody(body)

    if (statusCode !== 200 || typeof response !== 'object' || response === null || response.success === false) {
      throw new Error(`Could not set managed headers: ${statusCode}, error: ${JSON.stringify(response)}`)
    }

    return response
  }

  async getDNSRecords () {
    const records = []
    let page = 1
    let totalPages = 1
    let lastResponse = { success: true, result: [] }

    while (page <= totalPages) {
      const url = CLOUDFLARE_API_URL + `zones/${this.zoneId}/dns_records?per_page=100&page=${page}`

      const { statusCode, body } = await this.requestWithDelay(url, {
        method: 'GET',
        headers: {
          ...this.authorizationHeaders
        }
      })

      const response = await this.parseResponseBody(body)

      if (statusCode !== 200 || typeof response !== 'object' || response === null || response.success === false) {
        throw new Error(`Could not get DNS records: ${statusCode}, error: ${JSON.stringify(response)}`)
      }

      lastResponse = response
      if (Array.isArray(response.result)) {
        records.push(...response.result)
      }

      totalPages = response.result_info?.total_pages ?? 1
      page += 1
    }

    return { ...lastResponse, result: records }
  }

  async deleteDNSRecord (id) {
    const url = CLOUDFLARE_API_URL + `zones/${this.zoneId}/dns_records/${id}`

    const { statusCode, body } = await this.requestWithDelay(url, {
      method: 'DELETE',
      headers: {
        ...this.authorizationHeaders
      }
    })

    const response = await this.parseResponseBody(body)

    if (statusCode !== 200 || typeof response !== 'object' || response === null || response.success === false) {
      throw new Error(`Could not delete DNS record: ${statusCode}, error: ${JSON.stringify(response)}`)
    }

    return response
  }

  async rewriteDNSRecords (dnsRecords) {
    if (!Array.isArray(dnsRecords) || dnsRecords.length === 0) {
      return
    }

    const currentDNSRecords = await this.getDNSRecords()
    let existingRecords = [...(currentDNSRecords.result ?? [])]
    const apexDomain = typeof this.domain === 'string'
      ? this.domain.trim().replace(/\.$/, '').toLowerCase()
      : ''
    const usedIds = new Set()
    const errors = []

    for (let index = 0; index < dnsRecords.length; index += 1) {
      const rawRecord = dnsRecords[index]

      try {
        const resolvedName = normalizeDNSRecordName(rawRecord.name, this.domain)
        const desiredName = resolvedName.toLowerCase()
        const desiredType = rawRecord.type.toUpperCase()
        const desiredRecord = { ...rawRecord, name: resolvedName }

        const conflicts = existingRecords.filter(existing =>
          isConflictingDNSRecord(existing, desiredName, desiredType, apexDomain)
        )

        for (const conflict of conflicts) {
          await this.deleteDNSRecord(conflict.id)
          existingRecords = existingRecords.filter(item => item.id !== conflict.id)
        }

        const candidates = existingRecords.filter(existing =>
          typeof existing.name === 'string' &&
          typeof existing.type === 'string' &&
          existing.name.toLowerCase() === desiredName &&
          existing.type.toUpperCase() === desiredType &&
          !usedIds.has(existing.id)
        )

        const exactMatch = candidates.find(existing => existing.content === desiredRecord.content)
        const remainingDesired = dnsRecords.slice(index + 1)
        const unclaimedCandidate = candidates.find(existing =>
          !remainingDesired.some(other =>
            typeof other?.name === 'string' &&
            typeof other?.type === 'string' &&
            normalizeDNSRecordName(other.name, this.domain).toLowerCase() === desiredName &&
            other.type.toUpperCase() === desiredType &&
            other.content === existing.content
          )
        )

        const currentDNSRecord =
          exactMatch ||
          unclaimedCandidate ||
          (desiredType === 'CNAME' ? candidates[0] : undefined)

        if (currentDNSRecord) {
          const updated = await this.updateDNSRecord(currentDNSRecord.id, desiredRecord)
          usedIds.add(currentDNSRecord.id)
          if (updated?.result) {
            Object.assign(currentDNSRecord, updated.result)
          }
        } else {
          const created = await this.createDNSRecord(desiredRecord)
          if (created?.result?.id) {
            existingRecords.push(created.result)
            usedIds.add(created.result.id)
          }
        }
      } catch (error) {
        console.error(`Could not update DNS record: ${JSON.stringify(rawRecord)}, error: ${error}`)
        errors.push(error)
      }
    }

    if (errors.length > 0) {
      throw new AggregateError(errors, `Could not update ${errors.length} DNS record(s) for domain ${this.domain}`)
    }
  }

  async createDNSRecord (dnsRecord) {
    const url = CLOUDFLARE_API_URL + `zones/${this.zoneId}/dns_records`

    const { statusCode, body } = await this.requestWithDelay(url, {
      method: 'POST',
      headers: {
        ...this.authorizationHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(dnsRecord)
    })

    const response = await this.parseResponseBody(body)

    if (statusCode !== 200 || typeof response !== 'object' || response === null || response.success === false) {
      throw new Error(`Could not create DNS record: ${statusCode}, error: ${JSON.stringify(response)}`)
    }

    return response
  }

  async updateDNSRecord (id, dnsRecord) {
    const url = CLOUDFLARE_API_URL + `zones/${this.zoneId}/dns_records/${id}`

    const { statusCode, body } = await this.requestWithDelay(url, {
      method: 'PATCH',
      headers: {
        ...this.authorizationHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(dnsRecord)
    })

    const response = await this.parseResponseBody(body)

    if (statusCode !== 200 || typeof response !== 'object' || response === null || response.success === false) {
      throw new Error(`Could not update DNS record: ${statusCode}, error: ${JSON.stringify(response)}`)
    }

    return response
  }

  async getFirewallRules () {
    const url = CLOUDFLARE_API_URL + `zones/${this.zoneId}/rulesets/phases/http_request_firewall_custom/entrypoint`

    const { statusCode, body } = await this.requestWithDelay(url, {
      method: 'GET',
      headers: {
        ...this.authorizationHeaders,
        'Content-Type': 'application/json'
      }
    })

    let response
    try {
      response = await body.json()
    } catch (e) {
      response = await body.text()
    }

    if (statusCode === 404) {
      console.log('Firewall ruleset was not found. Initializing firewall ruleset creation...')
      const createRulesetUrl = CLOUDFLARE_API_URL + `zones/${this.zoneId}/rulesets`
      const payload = {
        name: 'Custom firewall ruleset',
        kind: 'zone',
        phase: 'http_request_firewall_custom',
        rules: []
      }

      const { statusCode: createStatusCode, body: createBody } = await this.requestWithDelay(createRulesetUrl, {
        method: 'POST',
        headers: {
          ...this.authorizationHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      let createResponse
      try {
        createResponse = await createBody.json()
      } catch (e) {
        createResponse = await createBody.text()
      }

      if (createStatusCode !== 200) {
        throw new Error(`Could not create firewall ruleset: ${createStatusCode}, error: ${JSON.stringify(createResponse)}`)
      }

      const { id, rules } = createResponse?.result ?? {}
      if (!id) {
        throw new Error(`Could not get firewall rules ruleset ID: got ${id}, received value: ${JSON.stringify(createResponse)}`)
      }

      return { id, rules: rules ?? [] }
    } else if (statusCode !== 200) {
      throw new Error(`Could not get firewall rules: ${statusCode}, error: ${JSON.stringify(response)}`)
    }

    const { id, rules } = response?.result ?? {}
    if (!id) {
      throw new Error(`Could not get firewall rules ruleset ID: got ${id}, received value: ${JSON.stringify(response)}`)
    }

    return { id, rules }
  }

  async createFirewallRule (rulesetId, firewallRule) {
    const url = CLOUDFLARE_API_URL + `zones/${this.zoneId}/rulesets/${rulesetId}/rules`
    const rule = { ...firewallRule }

    const { statusCode, body } = await this.requestWithDelay(url, {
      method: 'POST',
      headers: {
        ...this.authorizationHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(rule)
    })

    let response
    try {
      response = await body.json()
    } catch (e) {
      response = await body.text()
    }

    if (statusCode !== 200) {
      throw new Error(`Could not create a firewall rule: ${statusCode}, error: ${JSON.stringify(response)}`)
    }

    return response
  }

  async updateFirewallRule (rulesetId, ruleId, firewallRule) {
    const url = CLOUDFLARE_API_URL + `zones/${this.zoneId}/rulesets/${rulesetId}/rules/${ruleId}`
    const rule = { ...firewallRule }

    const { statusCode, body } = await this.requestWithDelay(url, {
      method: 'PATCH',
      headers: {
        ...this.authorizationHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(rule)
    })

    let response
    try {
      response = await body.json()
    } catch (e) {
      response = await body.text()
    }

    if (statusCode !== 200) {
      throw new Error(`Could not update a firewall rule: ${statusCode}, error: ${JSON.stringify(response)}`)
    }

    return response
  }

  async rewriteFirewallRules (firewallRules) {
    const { id: rulesetId } = await this.getFirewallRules()

    if (!rulesetId) {
      console.error(`Could not update firewall rules for domain ${this.domain}: custom firewall ruleset id is not found`)
      throw new Error('Custom firewall ruleset id is not found')
    }

    const url = CLOUDFLARE_API_URL + `zones/${this.zoneId}/rulesets/${rulesetId}`

    const { statusCode, body } = await this.requestWithDelay(url, {
      method: 'PUT',
      headers: {
        ...this.authorizationHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ rules: firewallRules })
    })

    let response
    try {
      response = await body.json()
    } catch (e) {
      response = await body.text()
    }

    if (statusCode !== 200) {
      throw new Error(`Could not update firewall rules: ${statusCode}, error: ${JSON.stringify(response)}`)
    }
  }

  async getRedirectRules () {
    const url = CLOUDFLARE_API_URL + `zones/${this.zoneId}/rulesets/phases/http_request_dynamic_redirect/entrypoint`

    const { statusCode, body } = await this.requestWithDelay(url, {
      method: 'GET',
      headers: {
        ...this.authorizationHeaders,
        'Content-Type': 'application/json'
      }
    })

    let response
    try {
      response = await body.json()
    } catch (e) {
      response = await body.text()
    }

    if (statusCode === 404) {
      // Create http_request_dynamic_redirect ruleset if one doesn't exist
      console.log('Ruleset was not found. Initializing redirect ruleset creation...')
      const createRulesetUrl = CLOUDFLARE_API_URL + `zones/${this.zoneId}/rulesets`
      const payload = {
        name: 'Redirect rules ruleset',
        kind: 'zone',
        phase: 'http_request_dynamic_redirect',
        rules: []
      }

      const { statusCode: createStatusCode, body: createBody } = await this.requestWithDelay(createRulesetUrl, {
        method: 'POST',
        headers: {
          ...this.authorizationHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const createResponse = await createBody.json()

      if (createStatusCode !== 200) {
        throw new Error(`Could not create redirect ruleset: ${statusCode}, error: ${JSON.stringify(createResponse)}`)
      }

      const { id, rules } = createResponse?.result ?? {}
      if (!id) {
        throw new Error(`Could not get redirect rules ruleset ID: got ${id}, received value: ${JSON.stringify(response)}`)
      }

      return { id, rules: rules ?? [] }
    } else {
      if (statusCode !== 200) {
        throw new Error(`Could not get redirect rules: ${statusCode}, error: ${JSON.stringify(response)}`)
      }

      const { id, rules } = response?.result ?? {}
      if (!id) {
        throw new Error(`Could not get redirect rules ruleset ID: got ${id}, received value: ${JSON.stringify(response)}`)
      }

      return { id, rules: rules ?? [] }
    }
  }

  async createRedirectRule (rulesetId, redirectRule) {
    const url = CLOUDFLARE_API_URL + `zones/${this.zoneId}/rulesets/${rulesetId}/rules`

    const { statusCode, body } = await this.requestWithDelay(url, {
      method: 'POST',
      headers: {
        ...this.authorizationHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(redirectRule)
    })

    let response
    try {
      response = await body.json()
    } catch (e) {
      response = await body.text()
    }

    if (statusCode !== 200) {
      throw new Error(`Could not create a redirect rule: ${statusCode}, error: ${JSON.stringify(response)}`)
    }

    return response
  }

  async updateRedirectRule (rulesetId, ruleId, redirectRule) {
    const url = CLOUDFLARE_API_URL + `zones/${this.zoneId}/rulesets/${rulesetId}/rules/${ruleId}`

    const { statusCode, body } = await this.requestWithDelay(url, {
      method: 'PATCH',
      headers: {
        ...this.authorizationHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(redirectRule)
    })

    let response
    try {
      response = await body.json()
    } catch (e) {
      response = await body.text()
    }

    if (statusCode !== 200) {
      throw new Error(`Could not update a redirect rule: ${statusCode}, error: ${JSON.stringify(response)}`)
    }

    return response
  }

  async rewriteRedirectRules (redirectRules) {
    const { id: rulesetId } = await this.getRedirectRules()

    if (!rulesetId) {
      console.error(`Could not update redirect rules for domain ${this.domain}: custom firewall ruleset id is not found`)
      throw new Error('Custom redirect ruleset id is not found')
    }

    const url = CLOUDFLARE_API_URL + `zones/${this.zoneId}/rulesets/${rulesetId}`

    const { statusCode, body } = await this.requestWithDelay(url, {
      method: 'PUT',
      headers: {
        ...this.authorizationHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ rules: redirectRules })
    })

    let response
    try {
      response = await body.json()
    } catch (e) {
      response = await body.text()
    }

    if (statusCode !== 200) {
      throw new Error(`Could not update redirect rules: ${statusCode}, error: ${JSON.stringify(response)}`)
    }
  }

  async setPolish (value) {
    const url = CLOUDFLARE_API_URL + `zones/${this.zoneId}/settings/polish`

    const { statusCode, body } = await this.requestWithDelay(url, {
      method: 'PATCH',
      headers: {
        ...this.authorizationHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ value })
    })

    const response = await body.json()

    if (statusCode !== 200) {
      throw new Error(`Could not set polish: ${statusCode}, error: ${JSON.stringify(response)}`)
    }

    return response
  }

  async setMinify (value) {
    const url = CLOUDFLARE_API_URL + `zones/${this.zoneId}/settings/minify`

    const { statusCode, body } = await this.requestWithDelay(url, {
      method: 'PATCH',
      headers: {
        ...this.authorizationHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ value })
    })

    const response = await body.json()

    if (statusCode !== 200) {
      throw new Error(`Could not set minify: ${statusCode}, error: ${JSON.stringify(response)}`)
    }

    return response
  }

  async setHTTP2Prioritization (value) {
    const url = CLOUDFLARE_API_URL + `zones/${this.zoneId}/settings/h2_prioritization`

    const { statusCode, body } = await this.requestWithDelay(url, {
      method: 'PATCH',
      headers: {
        ...this.authorizationHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ value })
    })

    const response = await body.json()

    if (statusCode !== 200) {
      throw new Error(`Could not set HTTP2 prioritization: ${statusCode}, error: ${JSON.stringify(response)}`)
    }

    return response
  }

  async setPrefetchURLs (value) {
    const url = CLOUDFLARE_API_URL + `zones/${this.zoneId}/settings/prefetch_preload`

    const { statusCode, body } = await this.requestWithDelay(url, {
      method: 'PATCH',
      headers: {
        ...this.authorizationHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ value })
    })

    const response = await body.json()

    if (statusCode !== 200) {
      if (response && response.errors && response.errors.find(e => e.code === 1015)) {
        return response
      }
      throw new Error(`Could not set prefetch URLs: ${statusCode}, error: ${JSON.stringify(response)}`)
    }

    return response
  }

  async setHttp2 (value) {
    const url = CLOUDFLARE_API_URL + `zones/${this.zoneId}/settings/http2`

    const { statusCode, body } = await this.requestWithDelay(url, {
      method: 'PATCH',
      headers: {
        ...this.authorizationHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ value })
    })

    const response = await body.json()

    if (statusCode !== 200) {
      if (response && response.errors && response.errors.find(e => e.code === 1015)) {
        return response
      }
      throw new Error(`Could not set HTTP2: ${statusCode}, error: ${JSON.stringify(response)}`)
    }

    return response
  }

  async setHttp3 (value) {
    const url = CLOUDFLARE_API_URL + `zones/${this.zoneId}/settings/http3`

    const { statusCode, body } = await this.requestWithDelay(url, {
      method: 'PATCH',
      headers: {
        ...this.authorizationHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ value })
    })

    const response = await body.json()

    if (statusCode !== 200) {
      throw new Error(`Could not set HTTP3: ${statusCode}, error: ${JSON.stringify(response)}`)
    }

    return response
  }

  async set0RTT (value) {
    const url = CLOUDFLARE_API_URL + `zones/${this.zoneId}/settings/0rtt`

    const { statusCode, body } = await this.requestWithDelay(url, {
      method: 'PATCH',
      headers: {
        ...this.authorizationHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ value })
    })

    const response = await body.json()

    if (statusCode !== 200) {
      throw new Error(`Could not set 0-RTT: ${statusCode}, error: ${JSON.stringify(response)}`)
    }

    return response
  }

  async setArgoSmartRouting (value) {
    const url = CLOUDFLARE_API_URL + `zones/${this.zoneId}/argo/smart_routing`

    const { statusCode, body } = await this.requestWithDelay(url, {
      method: 'PATCH',
      headers: {
        ...this.authorizationHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ value })
    })

    const response = await body.json()

    if (statusCode !== 200) {
      throw new Error(`Could not set Argo Smart Routing: ${statusCode}, error: ${JSON.stringify(response)}`)
    }

    return response
  }

  async getPageRules () {
    const url = CLOUDFLARE_API_URL + `zones/${this.zoneId}/pagerules`

    const { statusCode, body } = await this.requestWithDelay(url, {
      method: 'GET',
      headers: {
        ...this.authorizationHeaders,
        'Content-Type': 'application/json'
      }
    })

    const response = await body.json()

    if (statusCode !== 200) {
      throw new Error(`Could not get page rules: ${statusCode}, error: ${JSON.stringify(response)}`)
    }

    return response
  }

  async updatePageRule (pageRuleId, pageRule) {
    const url = CLOUDFLARE_API_URL + `zones/${this.zoneId}/pagerules/${pageRuleId}`

    const { statusCode, body } = await this.requestWithDelay(url, {
      method: 'PUT',
      headers: {
        ...this.authorizationHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(pageRule)
    })

    const response = await body.json()

    if (statusCode !== 200) {
      throw new Error(`Could not update page rule: ${statusCode}, error: ${JSON.stringify(response)}`)
    }

    return response
  }

  async createPageRule (pageRule) {
    const url = CLOUDFLARE_API_URL + `zones/${this.zoneId}/pagerules`

    const { statusCode, body } = await this.requestWithDelay(url, {
      method: 'POST',
      headers: {
        ...this.authorizationHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(pageRule)
    })

    const response = await body.json()

    if (statusCode !== 200) {
      throw new Error(`Could not create page rule: ${statusCode}, error: ${JSON.stringify(response)}`)
    }

    return response
  }

  async rewritePageRules (pageRules) {
    const currentPageRules = await this.getPageRules()
    const errors = []

    for (const pageRule of pageRules) {
      const currentPageRule = currentPageRules.result.find(currentPageRule => {
        for (const currentPageRuleTarget of currentPageRule.targets) {
          const pageRuleTarget = pageRule.targets.find(pageRuleTarget => {
            return currentPageRuleTarget.target === pageRuleTarget.target &&
              currentPageRuleTarget.constraint?.operator === pageRuleTarget.constraint?.operator &&
              currentPageRuleTarget.constraint?.value === pageRuleTarget.constraint?.value
          })
          if (pageRuleTarget === undefined) return false
        }
        return true
      })

      try {
        if (currentPageRule) {
          await this.updatePageRule(currentPageRule.id, pageRule)
        } else {
          await this.createPageRule(pageRule)
        }
      } catch (error) {
        console.error(`Could not update or create page rule for domain ${this.domain}: ${error.message}\n`)
        errors.push(error)
      }
    }

    if (errors.length > 0) {
      throw new AggregateError(errors, `Could not update ${errors.length} page rule(s) for domain ${this.domain}`)
    }
  }

  async getAvailablePageRules () {
    const url = CLOUDFLARE_API_URL + `zones/${this.zoneId}/pagerules/settings`

    const { statusCode, body } = await this.requestWithDelay(url, {
      method: 'GET',
      headers: {
        ...this.authorizationHeaders,
        'Content-Type': 'application/json'
      }
    })

    const response = await body.json()

    if (statusCode !== 200) {
      throw new Error(`Could not get available page rules: ${statusCode}, error: ${JSON.stringify(response)}`)
    }

    return response
  }

  async createWorkerRoute (workerRoute) {
    const url = CLOUDFLARE_API_URL + `zones/${this.zoneId}/workers/routes`

    const { statusCode, body } = await this.requestWithDelay(url, {
      method: 'POST',
      headers: {
        ...this.authorizationHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(workerRoute)
    })

    const response = await body.json()

    if (statusCode !== 200) {
      throw new Error(`Could not create worker routes: ${statusCode}, error: ${JSON.stringify(response)}`)
    }

    return response
  }

  async createWorkerRoutes (workerRoutes) {
    const results = await Promise.allSettled(workerRoutes.map(workerRoute => this.createWorkerRoute(workerRoute)))
    const errors = []

    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      const workerRoute = workerRoutes[i]

      if (result.status === 'rejected') {
        console.error(`Could not create worker route for domain ${this.domain} ${JSON.stringify(workerRoute)}: ${result.reason}\n`)
        errors.push(result.reason)
      }
    }

    if (errors.length > 0) {
      throw new AggregateError(errors, `Could not create ${errors.length} worker route(s) for domain ${this.domain}`)
    }
  }

  async getWorkerRoutes () {
    const url = CLOUDFLARE_API_URL + `zones/${this.zoneId}/workers/routes`

    const { statusCode, body } = await this.requestWithDelay(url, {
      method: 'GET',
      headers: {
        ...this.authorizationHeaders,
        'Content-Type': 'application/json'
      }
    })

    const response = await body.json()

    if (statusCode !== 200) {
      throw new Error(`Could not get worker routes: ${statusCode}, error: ${JSON.stringify(response)}`)
    }

    return response
  }

  async deleteWorkerRoute (routeId) {
    const url = CLOUDFLARE_API_URL + `zones/${this.zoneId}/workers/routes/${routeId}`

    const { statusCode, body } = await this.requestWithDelay(url, {
      method: 'DELETE',
      headers: {
        ...this.authorizationHeaders,
        'Content-Type': 'application/json'
      }
    })

    const response = await body.json()

    if (statusCode !== 200) {
      throw new Error(`Could not delete worker route: ${statusCode}, error: ${JSON.stringify(response)}`)
    }

    return response
  }

  async deleteWorkerRoutes (routeIds) {
    const results = await Promise.allSettled(routeIds.map(routeId => this.deleteWorkerRoute(routeId)))
    const errors = []

    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      const routeId = routeIds[i]

      if (result.status === 'rejected') {
        console.error(`Could not delete worker route for domain ${this.domain} ${routeId}: ${result.reason}\n`)
        errors.push(result.reason)
      }
    }

    if (errors.length > 0) {
      throw new AggregateError(errors, `Could not delete ${errors.length} worker route(s) for domain ${this.domain}`)
    }
  }

  async rewriteWorkerRoutes (workerRoutes) {
    const currentWorkerRoutes = await this.getWorkerRoutes()
    const currentWorkerRoutesIds = currentWorkerRoutes.result.map(route => route.id)

    if (currentWorkerRoutesIds.length > 0) {
      await this.deleteWorkerRoutes(currentWorkerRoutesIds)
    }

    await this.createWorkerRoutes(workerRoutes)
  }

  async setHotlinkProtection (value) {
    const url = CLOUDFLARE_API_URL + `zones/${this.zoneId}/settings/hotlink_protection`

    const { statusCode, body } = await this.requestWithDelay(url, {
      method: 'PATCH',
      headers: {
        ...this.authorizationHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ value })
    })

    const response = await body.json()

    if (statusCode !== 200) {
      throw new Error(`Could not change hotlink protection: ${statusCode}, error: ${JSON.stringify(response)}`)
    }

    return response
  }

  async uploadTlsClientAuth ({ clientKey, clientCert, caCert, clear }) {
    if (clear) {
      await this.clearCustomCerts()
    }

    if (clientKey && clientCert && caCert) {
      try {
        await fs.access(clientKey, fs.constants.R_OK)
        await fs.access(clientCert, fs.constants.R_OK)
        await fs.access(caCert, fs.constants.R_OK)
      } catch (e) {
        throw new Error(`Cancelling cert upload for domain ${this.domain}. Cannot access file: ${e?.message}`)
      }

      const clientKeyContents = await fs.readFile(clientKey, 'utf8')
      const clientCertContents = await fs.readFile(clientCert, 'utf8')
      const caCertContents = await fs.readFile(caCert, 'utf8')

      await this.uploadCertAndKey(clientCertContents, clientKeyContents)
      await this.uploadCaCert(caCertContents)
      await this.enableTLSClientAuth()
    }
  }

  async clearCustomCerts () {
    console.log(`Initiating certificate clear for domain ${this.domain}...`, new Date().toISOString())
    const clientCertIds = await this.getClientCerts()
    const caCertIds = await this.getCaCerts()

    console.log(`Client certificates found for domain ${this.domain}: ${clientCertIds?.join(', ')}`, new Date().toISOString())
    console.log(`CA certificates found for domain ${this.domain}: ${caCertIds?.join(', ')}`, new Date().toISOString())

    for (const cert of clientCertIds) {
      try {
        await this.deleteClientCert(cert)
      } catch (e) {
        console.error(`Failed to delete Client cert for domain ${this.domain}: ${e?.message}`, new Date().toISOString())
      }
    }

    for (const cert of caCertIds) {
      try {
        await this.deleteCaCert(cert)
      } catch (e) {
        console.error(`Failed to delete CA cert for domain ${this.domain}: ${e?.message}`, new Date().toISOString())
      }
    }
  }

  async getClientCerts () {
    const url = CLOUDFLARE_API_URL + `zones/${this.zoneId}/origin_tls_client_auth`
    const { statusCode, body } = await this.requestWithDelay(url, {
      method: 'GET',
      headers: {
        ...this.authorizationHeaders,
        'Content-Type': 'application/json'
      }
    })
    const response = await body.json()

    if (statusCode !== 200) {
      console.error(`Could not get client certificate IDs for domain ${this.domain}: ${statusCode}, error: ${JSON.stringify(response)}`, new Date().toISOString())
      throw new Error(`Could not get client certificate IDs for domain ${this.domain}: ${statusCode}, error: ${JSON.stringify(response)}`)
    }

    return response?.result?.map((cert) => cert?.id) ?? []
  }

  async getCaCerts () {
    const url = CLOUDFLARE_API_URL + `zones/${this.zoneId}/acm/custom_trust_store`
    const { statusCode, body } = await this.requestWithDelay(url, {
      method: 'GET',
      headers: {
        ...this.authorizationHeaders,
        'Content-Type': 'application/json'
      }
    })
    const response = await body.json()

    if (statusCode !== 200) {
      console.error(`Could not get CA certificate IDs for domain ${this.domain}: ${statusCode}, error: ${JSON.stringify(response)}`, new Date().toISOString())
      throw new Error(`Could not get CA certificate IDs for domain ${this.domain}: ${statusCode}, error: ${JSON.stringify(response)}`)
    }

    return response?.result?.map((cert) => cert?.id) ?? []
  }

  async deleteClientCert (certId) {
    const url = CLOUDFLARE_API_URL + `zones/${this.zoneId}/origin_tls_client_auth/${certId}`
    const { statusCode, body } = await this.requestWithDelay(url, {
      method: 'DELETE',
      headers: {
        ...this.authorizationHeaders,
        'Content-Type': 'application/json'
      }
    })
    const response = await body.json()

    if (statusCode !== 200) {
      throw new Error(`Could not delete client certificate ID ${certId}: ${statusCode}, error: ${JSON.stringify(response)}`)
    }

    console.log(`Deleted client certificate ID ${certId} for ${this.domain}`, new Date().toISOString())
  }

  async deleteCaCert (certId) {
    const url = CLOUDFLARE_API_URL + `zones/${this.zoneId}/acm/custom_trust_store/${certId}`
    const { statusCode, body } = await this.requestWithDelay(url, {
      method: 'DELETE',
      headers: {
        ...this.authorizationHeaders,
        'Content-Type': 'application/json'
      }
    })
    const response = await body.json()

    if (statusCode !== 200) {
      console.error(`Could not delete CA certificate ID ${certId}: ${statusCode}, error: ${JSON.stringify(response)}`, new Date().toISOString())
      throw new Error(`Could not delete CA certificate ID ${certId}: ${statusCode}, error: ${JSON.stringify(response)}`)
    }

    console.log(`Deleted CA certificate ID ${certId} for ${this.domain}`, new Date().toISOString())
  }

  async uploadCertAndKey (clientCert, clientKey) {
    const url = CLOUDFLARE_API_URL + `zones/${this.zoneId}/origin_tls_client_auth`
    const payload = {
      certificate: clientCert.replace(/\r?\n/g, '\n'),
      private_key: clientKey.replace(/\r?\n/g, '\n')
    }

    const { statusCode, body } = await this.requestWithDelay(url, {
      method: 'POST',
      headers: {
        ...this.authorizationHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    const response = await body.json()

    if (statusCode !== 200 && statusCode !== 201) {
      const errors = response?.errors ?? []
      if (errors.find((error) => error.code === 1406 && error.message === 'This certificate already exists for this zone.')) {
        console.log(`This certificate already exists for domain ${this.domain}. Continuing...`, new Date().toISOString())
      } else {
        console.error(`Could not upload certificate and private key: ${statusCode}, error: ${JSON.stringify(response)}`, new Date().toISOString())
        throw new Error(`Could not upload certificate and private key: ${statusCode}, error: ${JSON.stringify(response)}`)
      }
    }

    console.log(`Client certificate uploaded for domain ${this.domain}, cert id: ${response?.result?.id}`, new Date().toISOString())
  }

  async uploadCaCert (caCert) {
    const url = CLOUDFLARE_API_URL + `zones/${this.zoneId}/acm/custom_trust_store`
    const payload = {
      certificate: caCert.replace(/\r?\n/g, '\n')
    }

    const { statusCode, body } = await this.requestWithDelay(url, {
      method: 'POST',
      headers: {
        ...this.authorizationHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    const response = await body.json()

    if (statusCode !== 200 && statusCode !== 201) {
      const errors = response?.errors ?? []
      if (errors.find((error) => error.code === 1406 && error.message === 'This certificate already exists for this zone.')) {
        console.log(`This CA certificate already exists for domain ${this.domain}. Continuing...`)
      } else {
        throw new Error(`Could not upload CA certificate: ${statusCode}, error: ${JSON.stringify(response)}`)
      }
    }

    console.log(`CA certificate uploaded for domain ${this.domain}, cert id: ${response?.result?.id}`, new Date().toISOString())
  }

  async enableTLSClientAuth () {
    const url = CLOUDFLARE_API_URL + `zones/${this.zoneId}/settings/tls_client_auth`
    const { statusCode, body } = await this.requestWithDelay(url, {
      method: 'PATCH',
      headers: {
        ...this.authorizationHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ value: 'on' })
    })

    const response = await body.json()

    if (statusCode !== 200) {
      throw new Error(`Could not enable TSL Client Auth setting: ${statusCode}, error: ${JSON.stringify(response)}`)
    }

    console.log(`Enabled TSL Client Auth setting for domain ${this.domain}`, new Date().toISOString())
  }

  async requestWithDelay (url, options) {
    const response = await request(url, options)
    await delay(this.requestDelay)
    return response
  }
}

function normalizeDNSRecordName (name, domain) {
  const trimmed = String(name).trim().replace(/\.$/, '')
  if (!domain) {
    return trimmed
  }

  const cleanDomain = String(domain).trim().replace(/\.$/, '')
  if (trimmed === '@') {
    return cleanDomain
  }

  const lowerName = trimmed.toLowerCase()
  const lowerDomain = cleanDomain.toLowerCase()
  if (lowerName === lowerDomain || lowerName.endsWith(`.${lowerDomain}`)) {
    return trimmed
  }

  return `${trimmed}.${cleanDomain}`
}

function isConflictingDNSRecord (existing, desiredName, desiredType, apexDomain) {
  if (typeof existing?.name !== 'string' || typeof existing?.type !== 'string') {
    return false
  }

  if (existing.name.toLowerCase() !== desiredName) {
    return false
  }

  const existingType = existing.type.toUpperCase()
  if (desiredType === 'CNAME') {
    if (desiredName === apexDomain) {
      return existingType === 'A' || existingType === 'AAAA'
    }

    return existingType !== 'CNAME'
  }

  if (desiredType === 'A' || desiredType === 'AAAA') {
    return existingType === 'CNAME'
  }

  return desiredName !== apexDomain && existingType === 'CNAME'
}

function delay (delayMs) {
  return new Promise(resolve => setTimeout(resolve, delayMs))
}

module.exports = CloudFlare
