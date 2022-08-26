'use strict'

const fs = require('node:fs/promises')
const path = require('node:path')

const { request, ProxyAgent } = require('undici')
const xmlBuilder = require('xmlbuilder')

const CloudFlare = require('./cloudflare')

const XML_WORKER_TEMPLATE_PATH = path.join(__dirname, 'xml-template.js')
const XML_WORKER_TEMPLATE_TAG = 'XML_REPLACE_TAG'

const TXT_WORKER_TEMPLATE_PATH = path.join(__dirname, 'txt-template.js')
const TXT_WORKER_TEMPLATE_TAG = 'TXT_REPLACE_TAG'

const MAX_RETRY_COUNT = 5

const cloudFlare = new CloudFlare(
  process.env.CLOUDFLARE_EMAIL,
  process.env.CLOUDFLARE_API_KEY
)

async function fetchSiteLocales (url, proxy, retryCount = 0) {
  try {
    const { statusCode, body } = await request(url, {
      dispatcher: proxy,
      method: 'GET',
      headers: {
        Accept: 'application/vnd.softswiss.v1+json',
        'user-agent': 'sitemap-generator-ss',
        'content-type': 'application/json'
      }
    })

    if (statusCode !== 200) {
      throw new Error(`Could not get site locales: ${statusCode}`)
    }

    return body.json()
  } catch (error) {
    if (retryCount < MAX_RETRY_COUNT) {
      return fetchSiteLocales(url, proxy, retryCount + 1)
    } else {
      throw new Error(`Could not get site locales: ${error}`)
    }
  }
}

function getLocalesCodes (locales) {
  return locales.map(locale => locale.code)
}

function filterLocalesCodes (locales, disabledLocales) {
  return locales.filter(locale => !disabledLocales.includes(locale))
}

async function fetchSitePagesInfo (url, proxy, retryCount = 0) {
  try {
    const { statusCode, body } = await request(url, {
      dispatcher: proxy,
      method: 'GET',
      headers: {
        Accept: 'application/vnd.softswiss.v1+json',
        'user-agent': 'sitemap-generator-ss',
        'content-type': 'application/json'
      }
    })

    if (statusCode !== 200) {
      throw new Error(`Could not get site pages: ${statusCode}`)
    }

    return await body.json()
  } catch (error) {
    if (retryCount < MAX_RETRY_COUNT) {
      return fetchSitePagesInfo(url, proxy, retryCount + 1)
    } else {
      throw new Error(`Could not get site pages: ${error}`)
    }
  }
}

function getSitePagesPaths (pagesInfo) {
  const sitePaths = ['']
  for (const pageInfo of pagesInfo) {
    sitePaths.push(...getSitePagePaths(pageInfo))
  }
  return sitePaths
}

function getSitePagePaths (pageInfo) {
  const pagePaths = [pageInfo.path]
  if (pageInfo.children) {
    for (const childPage of pageInfo.children) {
      pagePaths.push(...getSitePagePaths(childPage))
    }
  }
  return pagePaths
}

function filterPagesPaths (sitePagesPaths, disabledUrls) {
  return sitePagesPaths.filter(path => {
    for (const disabledUrl of disabledUrls) {
      const regex = new RegExp(disabledUrl)
      if (regex.test(path)) {
        return false
      }
    }
    return true
  })
}

async function fetchExtendedSitePageInfo (url, pagePath, localeCode, proxy, retryCount = 0) {
  if (pagePath === '') {
    return { blocks: {} }
  }

  const pageURL = url + '/' + pagePath

  try {
    const { statusCode, body } = await request(pageURL, {
      dispatcher: proxy,
      method: 'GET',
      headers: {
        Accept: 'application/vnd.softswiss.v1+json',
        'content-type': 'application/json',
        'user-agent': 'sitemap-generator-ss',
        'accept-language': localeCode
      }
    })

    console.log(statusCode, localeCode, pagePath, `attempt: ${retryCount}`)

    if (statusCode !== 200) {
      if (statusCode === 404) {
        return null
      } else {
        const response = await body.text()
        throw new Error(`Could not get ${pageURL} site page blocks for locale ${localeCode}: ${statusCode}, ${response}`)
      }
    }

    return await body.json()
  } catch (error) {
    if (retryCount < MAX_RETRY_COUNT) {
      console.log(localeCode, pagePath, error, `attempt: ${retryCount}`)
      return fetchExtendedSitePageInfo(url, pagePath, localeCode, proxy, retryCount + 1)
    } else {
      throw new Error(`Could not get ${pageURL} site page blocks for locale ${localeCode}: ${error}`)
    }
  }
}

async function filterPagesByNoIndex (url, siteLocales, pagesPaths, proxy) {
  const filteredPages = await Promise.all(siteLocales.map(
    siteLocale => filterLocalePagesByNoIndex(url, siteLocale, pagesPaths, proxy))
  )

  const pagesByLocale = {}
  for (let i = 0; i < siteLocales.length; i++) {
    const siteLocale = siteLocales[i]
    pagesByLocale[siteLocale] = filteredPages[i]
  }
  return pagesByLocale
}

async function filterLocalePagesByNoIndex (url, siteLocale, pagesPaths, proxy) {
  const extendedPagesInfo = await Promise.all(pagesPaths.map(
    pagesPath => fetchExtendedSitePageInfo(url, pagesPath, siteLocale, proxy))
  )

  const filteredPages = []
  for (let i = 0; i < pagesPaths.length; i++) {
    const pagePath = pagesPaths[i]
    const extendedPageInfo = extendedPagesInfo[i]

    if (extendedPageInfo === null) {
      continue
    }

    const blocks = extendedPageInfo.blocks
    if (blocks.noindex || blocks.invisible_route) {
      continue
    }

    filteredPages.push(pagePath)
  }
  return filteredPages
}

function generateXML (baseURL, pathsByLocale) {
  const xml = xmlBuilder.create('urlset', { version: '1.0', encoding: 'UTF-8' })
    .att({
      xmlns: 'http://www.sitemaps.org/schemas/sitemap/0.9',
      'xmlns:xhtml': 'http://www.w3.org/1999/xhtml'
    })

  for (const [locale, paths] of Object.entries(pathsByLocale)) {
    for (const pagePath of paths) {
      const [priority, freq] = getMetadata(pagePath)
      const url = generateUrl(baseURL, pagePath, locale)

      const xUrl = xml.ele('url')
      xUrl.ele('loc', url)
      xUrl.ele('priority', priority.toFixed(1))
      xUrl.ele('changefreq', freq)

      for (const [locale, paths] of Object.entries(pathsByLocale)) {
        if (paths.includes(pagePath)) {
          xUrl.ele('xhtml:link')
            .att({
              rel: 'alternate',
              hreflang: locale,
              href: generateUrl(baseURL, pagePath, locale)
            })
        }
      }
    }
  }

  return xml.end({ pretty: true, indent: '  ', newline: '\n' })
}

function generateUrl (baseURl, pagePath, locale) {
  let url = baseURl
  if (locale !== 'en') {
    url += '/' + locale
  }
  if (pagePath !== '') {
    url += '/' + pagePath
  }
  return url
}

function getMetadata (path) {
  const arr = path.split('/')
  switch (arr[0]) {
    case '': return [1.0, 'always']
    case 'games': return [0.8, 'daily']
    default: return [0.6, 'weekly']
  }
}

async function updateXmlSiteWorker (siteConfig) {
  const proxy = new ProxyAgent({
    uri: siteConfig.proxy.url,
    auth: Buffer.from(`${siteConfig.proxy.username}:${siteConfig.proxy.password}`).toString('base64'),
    headers: { 'proxy-connection': 'keep-alive' },
    connections: 5
  })

  const [siteLocales, sitePagesInfo] = await Promise.all(
    [
      fetchSiteLocales(siteConfig.SS_API_LOCALES_URL, proxy),
      fetchSitePagesInfo(siteConfig.SS_API_PAGES_URL, proxy)
    ]
  )

  const siteLocalesCodes = filterLocalesCodes(getLocalesCodes(siteLocales), siteConfig.disabledLocales)
  const sitePagesPaths = filterPagesPaths(getSitePagesPaths(sitePagesInfo), siteConfig.disabledUrls)

  const pathsByLocale = await filterPagesByNoIndex(
    siteConfig.SS_API_PAGES_URL,
    siteLocalesCodes,
    sitePagesPaths,
    proxy
  )

  proxy.close()

  const xmlDocument = generateXML(siteConfig.BASE, pathsByLocale)

  const xmlWorkerScriptTemplate = await fs.readFile(XML_WORKER_TEMPLATE_PATH, 'utf8')
  const xmlWorkerScript = xmlWorkerScriptTemplate.replace(XML_WORKER_TEMPLATE_TAG, xmlDocument)

  console.log(xmlWorkerScript)
  await cloudFlare.uploadWorkerScript(siteConfig.ACCOUNT_ID, siteConfig.WORKER_NAME, xmlWorkerScript)
}

async function updateTxtSiteWorker (siteConfig, robotsData) {
  const txtWorkerScriptTemplate = await fs.readFile(TXT_WORKER_TEMPLATE_PATH, 'utf8')
  const txtWorkerScript = txtWorkerScriptTemplate.replace(TXT_WORKER_TEMPLATE_TAG, robotsData)
  await cloudFlare.uploadWorkerScript(siteConfig.ACCOUNT_ID, siteConfig.WORKER_NAME, txtWorkerScript)
}

module.exports = { updateXmlSiteWorker, updateTxtSiteWorker }
