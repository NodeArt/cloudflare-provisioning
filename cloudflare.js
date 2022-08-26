'use strict'

const { request } = require('undici')

const CLOUDFLARE_API_URL = 'https://api.cloudflare.com/client/v4/'

class CloudFlare {
  constructor (email, apiKey) {
    this.email = email
    this.apiKey = apiKey
  }

  async uploadWorkerScript (accountId, scriptName, script) {
    const url = CLOUDFLARE_API_URL + `accounts/${accountId}/workers/scripts/${scriptName}`

    const { statusCode, body } = await request(url, {
      method: 'PUT',
      headers: {
        'X-Auth-Email': this.email,
        'X-Auth-Key': this.apiKey,
        'Content-Type': 'application/javascript'
      },
      body: script
    })

    const response = await body.json()

    if (statusCode !== 200) {
      throw new Error(`Could not update worker script: ${statusCode}, error: ${JSON.stringify(response)}`)
    }
  }
}

module.exports = CloudFlare
