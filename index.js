'use strict'

const template = require('./template')
const CloudFlare = require('./cloudflare')

const cloudflareSettingsHandlers = {
  ssl: CloudFlare.prototype.setSSL,
  ipV6: CloudFlare.prototype.setIPv6,
  emailObfuscation: CloudFlare.prototype.setEmailObfuscation,
  brotli: CloudFlare.prototype.setBrotli,
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
  hotlinkProtection: CloudFlare.prototype.setHotlinkProtection
}

function substituteDomainName (settings, domainName) {
  return JSON.parse(JSON.stringify(settings).replaceAll('$DOMAIN', domainName))
}

async function applyCloudflareSettings (config) {
  if (config.domains === undefined) {
    throw new Error('No domains defined in config')
  }

  const accountEmail = process.env.CLOUDFLARE_EMAIL
  const accountKey = process.env.CLOUDFLARE_API_KEY

  if (config.enabled === false) {
    console.log('Config is disabled and would not be applied:', config.domains)
    return
  }

  const { domains: sites, settings } = config

  for (const site of sites) {
    const zoneId = site.zoneId
    if (zoneId === undefined) {
      throw new Error('Cloudflare zone ID is not defined')
    }

    const options = site.token === undefined
      ? { email: accountEmail, apiKey: accountKey }
      : { token: site.token }

    const cloudFlare = new CloudFlare(zoneId, site.domain, options)
    const domainSettings = substituteDomainName(settings, site.domain)

    for (const [key, value] of Object.entries(domainSettings)) {
      try {
        const settingHandler = cloudflareSettingsHandlers[key]

        if (settingHandler === undefined) {
          throw new Error(`Unsupported Cloudflare setting: ${key}, for domain: ${site.domain}`)
        }

        await settingHandler.call(cloudFlare, value)
      } catch (error) {
        console.error(`Failed to set Cloudflare setting ${key} for domain ${site.domain}: ${error.message}\n`)
      }
    }
  }
}

module.exports = { applyCloudflareSettings, template }
