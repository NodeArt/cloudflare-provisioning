'use strict'

const { request } = require('undici')

const CLOUDFLARE_API_URL = 'https://api.cloudflare.com/client/v4/'

class CloudFlare {
  constructor (zoneId, options) {
    this.zoneId = zoneId

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

    const { statusCode, body } = await request(url, {
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

    const { statusCode, body } = await request(url, {
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

    const { statusCode, body } = await request(url, {
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

    const { statusCode, body } = await request(url, {
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

    const { statusCode, body } = await request(url, {
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

    const { statusCode, body } = await request(url, {
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

    const { statusCode, body } = await request(url, {
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

  async createFirewallRule (firewallRule) {
    const url = CLOUDFLARE_API_URL + `zones/${this.zoneId}/firewall/rules`

    const { statusCode, body } = await request(url, {
      method: 'POST',
      headers: {
        ...this.authorizationHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([firewallRule])
    })

    const response = await body.json()

    if (statusCode !== 200) {
      throw new Error(`Could not create a firewall rule: ${statusCode}, error: ${JSON.stringify(response)}`)
    }

    return response
  }

  async createFirewallRules (firewallRules) {
    const results = await Promise.allSettled(firewallRules.map(firewallRule => this.createFirewallRule(firewallRule)))

    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      const firewallRule = firewallRules[i]

      if (result.status === 'rejected') {
        console.log(`Could not create firewallRule route ${JSON.stringify(firewallRule)}: ${result.reason}\n`)
      }
    }
  }

  async setPolish (value) {
    const url = CLOUDFLARE_API_URL + `zones/${this.zoneId}/settings/polish`

    const { statusCode, body } = await request(url, {
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

    const { statusCode, body } = await request(url, {
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

    const { statusCode, body } = await request(url, {
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

    const { statusCode, body } = await request(url, {
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

    const { statusCode, body } = await request(url, {
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

    const { statusCode, body } = await request(url, {
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

    const { statusCode, body } = await request(url, {
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

    const { statusCode, body } = await request(url, {
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

    const { statusCode, body } = await request(url, {
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

    const { statusCode, body } = await request(url, {
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

    const { statusCode, body } = await request(url, {
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
        console.log(`Could not update or create page rule: ${error.message}\n`)
      }
    }
  }

  async getAvailablePageRules () {
    const url = CLOUDFLARE_API_URL + `zones/${this.zoneId}/pagerules/settings`

    const { statusCode, body } = await request(url, {
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

    const { statusCode, body } = await request(url, {
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
        console.log(`Could not create worker route ${JSON.stringify(workerRoute)}: ${result.reason}\n`)
      }
    }
  }

  async getWorkerRoutes () {
    const url = CLOUDFLARE_API_URL + `zones/${this.zoneId}/workers/routes`

    const { statusCode, body } = await request(url, {
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

    const { statusCode, body } = await request(url, {
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
        console.log(`Could not delete worker route ${routeId}: ${result.reason}\n`)
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
}

module.exports = CloudFlare
