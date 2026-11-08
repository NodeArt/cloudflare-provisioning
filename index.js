'use strict'

const template = require('./template')
const CloudFlare = require('./cloudflare')

const cloudflareSettingsHandlers = {
  ssl: CloudFlare.prototype.setSSL,
  alwaysUseHttps: CloudFlare.prototype.setAlwaysUseHttps,
  minTlsVersion: CloudFlare.prototype.setMinTlsVersion,
  tls13: CloudFlare.prototype.setTls13,
  securityHeader: CloudFlare.prototype.setSecurityHeader,
  ipV6: CloudFlare.prototype.setIPv6,
  ipGeolocation: CloudFlare.prototype.setIpGeolocation,
  websockets: CloudFlare.prototype.setWebsockets,
  emailObfuscation: CloudFlare.prototype.setEmailObfuscation,
  brotli: CloudFlare.prototype.setBrotli,
  browserCacheTtl: CloudFlare.prototype.setBrowserCacheTtl,
  managedHeaders: CloudFlare.prototype.setManagedHeaders,
  dnsRecords: CloudFlare.prototype.rewriteDNSRecords,
  firewallRules: CloudFlare.prototype.rewriteFirewallRules,
  redirectRules: CloudFlare.prototype.rewriteRedirectRules,
  polish: CloudFlare.prototype.setPolish,
  minify: CloudFlare.prototype.setMinify,
  http2Prioritization: CloudFlare.prototype.setHTTP2Prioritization,
  prefetchURLs: CloudFlare.prototype.setPrefetchURLs,
  http2: CloudFlare.prototype.setHttp2,
  http3: CloudFlare.prototype.setHttp3,
  '0-RTT': CloudFlare.prototype.set0RTT,
  argoSmartRouting: CloudFlare.prototype.setArgoSmartRouting,
  workers: CloudFlare.prototype.rewriteWorkerRoutes,
  pageRules: CloudFlare.prototype.rewritePageRules,
  hotlinkProtection: CloudFlare.prototype.setHotlinkProtection,
  tlsClientAuth: CloudFlare.prototype.uploadTlsClientAuth
}

function substituteDomainName (settings = {}, domainName) {
  if (typeof domainName !== 'string' || domainName.length === 0) {
    return settings
  }

  return JSON.parse(JSON.stringify(settings).replaceAll('$DOMAIN', domainName))
}

async function applyCloudflareSettings (config) {
  if (config.domains === undefined) {
    throw new Error('No domains defined in config')
  }

  const accountEmail = process.env.CLOUDFLARE_EMAIL
  const accountKey = process.env.CLOUDFLARE_API_KEY
  const accountToken = process.env.CLOUDFLARE_TOKEN
  const parsedDelayMs = Number.parseInt(process.env.DELAY_MS, 10)
  const requestDelayMs = Number.isNaN(parsedDelayMs) || parsedDelayMs < 0 ? 500 : parsedDelayMs

  if (config.enabled === false) {
    console.log('Config is disabled and would not be applied:', config.domains)
    return
  }

  const { domains: sites, settings = {} } = config
  const errors = []

  for (const site of sites) {
    const zoneId = site.zoneId
    if (zoneId === undefined) {
      throw new Error('Cloudflare zone ID is not defined')
    }

    const options =
      (site.token && { token: site.token }) ||
      (accountToken && { token: accountToken }) ||
      { email: accountEmail, apiKey: accountKey }

    const cloudFlare = new CloudFlare(zoneId, site.domain, options, requestDelayMs)
    const domainSettings = substituteDomainName(settings, site.domain)

    for (const [key, value] of Object.entries(domainSettings)) {
      try {
        const settingHandler = Object.hasOwn(cloudflareSettingsHandlers, key)
          ? cloudflareSettingsHandlers[key]
          : undefined

        if (settingHandler === undefined) {
          throw new Error(`Unsupported Cloudflare setting: ${key}, for domain: ${site.domain}`)
        }

        await settingHandler.call(cloudFlare, value)
      } catch (error) {
        console.error(`Failed to set Cloudflare setting ${key} for domain ${site.domain}: ${error.message}\n`)
        errors.push(error)
      }
    }
  }

  if (errors.length > 0) {
    throw new AggregateError(errors, `Failed to apply ${errors.length} Cloudflare setting(s)`)
  }
}

module.exports = { applyCloudflareSettings, template }
