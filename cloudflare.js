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

  async getDNSRecords () {
    const url = CLOUDFLARE_API_URL + `zones/${this.zoneId}/dns_records`

    const { statusCode, body } = await this.requestWithDelay(url, {
      method: 'GET',
      headers: {
        ...this.authorizationHeaders,
        'Content-Type': 'application/json'
      }
    })

    const response = await body.json()

    if (statusCode !== 200) {
      throw new Error(`Could not get DNS records: ${statusCode}, error: ${JSON.stringify(response)}`)
    }

    return response
  }

  async rewriteDNSRecords (dnsRecords) {
    const currentDNSRecords = await this.getDNSRecords()

    for (const dnsRecord of dnsRecords) {
      const currentDNSRecord = currentDNSRecords.result.find(
        record => record.name === dnsRecord.name
      )

      try {
        if (currentDNSRecord) {
          await this.updateDNSRecord(currentDNSRecord.id, dnsRecord)
        } else {
          await this.createDNSRecord(dnsRecord)
        }
      } catch (error) {
        console.error(`Could not update DNS record: ${JSON.stringify(dnsRecord)}, error: ${error}`)
      }
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

    const response = await body.json()

    if (statusCode !== 200) {
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

    const response = await body.json()

    if (statusCode !== 200) {
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

    if (statusCode !== 200) {
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
    // Spread "filter" property from deprecated rule API
    const filter = firewallRule?.filter ?? {}
    const rule = { ...firewallRule, ...filter }
    delete rule.filter

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
    // Spread "filter" property from deprecated rule API
    const filter = firewallRule?.filter ?? {}
    const rule = { ...firewallRule, ...filter }
    delete rule.filter

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
    const { id: rulesetId, rules: currentFirewallRules } = await this.getFirewallRules()

    if (!rulesetId) {
      console.error(`Could not update firewall rules for domain ${this.domain}: custom firewall ruleset id is not found`)
      throw new Error('Custom firewall ruleset id is not found')
    }

    for (const firewallRule of firewallRules) {
      const currentFirewallRule = currentFirewallRules?.find(
        rule => rule.description === firewallRule.description
      )

      try {
        if (currentFirewallRule) {
          await this.updateFirewallRule(rulesetId, currentFirewallRule.id, firewallRule)
        } else {
          await this.createFirewallRule(rulesetId, firewallRule)
        }
      } catch (error) {
        console.error(`Could not update firewall rule for domain ${this.domain}: ${JSON.stringify(firewallRule)}, error: ${error}`)
      }
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
    const { id: rulesetId, rules: currentRedirectRules } = await this.getRedirectRules()

    if (!rulesetId) {
      console.error(`Could not update redirect rules for domain ${this.domain}: custom firewall ruleset id is not found`)
      throw new Error('Custom redirect ruleset id is not found')
    }

    for (const redirectRule of redirectRules) {
      const currentRedirectRule = currentRedirectRules?.find(
        rule => rule.description === redirectRule.description
      )

      try {
        if (currentRedirectRule) {
          await this.updateRedirectRule(rulesetId, currentRedirectRule.id, redirectRule)
        } else {
          await this.createRedirectRule(rulesetId, redirectRule)
        }
      } catch (error) {
        console.error(`Could not update redirect rule for domain ${this.domain}: ${JSON.stringify(redirectRule)}, error: ${error}`)
      }
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
        console.log(`Could not update or create page rule for domain ${this.domain}: ${error.message}\n`)
      }
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

    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      const workerRoute = workerRoutes[i]

      if (result.status === 'rejected') {
        console.log(`Could not create worker route for domain ${this.domain} ${JSON.stringify(workerRoute)}: ${result.reason}\n`)
      }
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

    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      const routeId = routeIds[i]

      if (result.status === 'rejected') {
        console.log(`Could not delete worker route for domain ${this.domain} ${routeId}: ${result.reason}\n`)
      }
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

function delay (delayMs) {
  return new Promise(resolve => setTimeout(resolve, delayMs))
}

module.exports = CloudFlare
