'use strict'

module.exports = {
  ssl: 'full',
  firewallRules: {
    blockSearchForMirrors: [
      {
        description: 'block bots',
        action: 'block',
        filter: {
          enabled: true,
          expression: '(cf.client.bot and not http.request.uri.path contains ".well-known")'
        }
      }
    ],
    bypassCMSApi: [
      {
        description: 'bypass cms api with proxy',
        action: 'bypass',
        products: ['uaBlock', 'bic', 'securityLevel'],
        filter: {
          enabled: true,
          expression: '(http.request.uri.path contains "/api/cms/pages" and http.user_agent eq "sitemap-generator-ss") or (http.request.uri.path eq "/api/info/locales" and http.user_agent eq "sitemap-generator-ss")'
        }
      }
    ],
    allowHotlinkFromKingtraf: [
      {
        description: 'allow hotlink from kingtraf',
        action: 'bypass',
        products: ['hot'],
        filter: {
          enabled: true,
          expression: '(http.referer contains "kingtraf.com")'
        }
      }
    ]
  },
  speedOptimization: {
    polish: 'lossy',
    minify: { css: 'off', html: 'off', js: 'off' },
    brotli: 'off',
    http2Prioritization: 'on',
    prefetchURLs: 'on'
  },
  workers: {
    sitemapCurasao: {
      pattern: '*$DOMAIN/sitemap.xml*',
      script: 'sitemap-curasao'
    },
    sitemapMalta: {
      pattern: '*$DOMAIN/sitemap.xml*',
      script: 'sitemap-malta'
    },
    sitemapAustralia: {
      pattern: '*$DOMAIN/sitemap.xml*',
      script: 'sitemap-xml-au'
    },
    robotsCurasao: {
      pattern: '*$DOMAIN/robots.txt*',
      script: 'kingbillycasinocom-robotstxt'
    },
    robotsMalta: {
      pattern: '*$DOMAIN/robots.txt*',
      script: 'kingbillycom-robotstxt'
    },
    robotsAustralia: {
      pattern: '*$DOMAIN/robots.txt*',
      script: 'robots_block_seo'
    },
    disableApi: {
      pattern: '*$DOMAIN/api/*',
      script: null
    },
    rootDomainCookies: {
      pattern: '*ia.$DOMAIN/C.ashx*',
      script: 'root-domain-cookies'
    },
    lpGeoRedirect: {
      pattern: 'lp.$DOMAIN/*',
      script: 'lp-geo-redirect'
    },
    geoRedirect: {
      pattern: '*$DOMAIN/*',
      script: 'geo-redirect'
    }
  },
  pageRules: {
    ssApiRequirements: {
      targets: [{ target: 'url', constraint: { operator: 'matches', value: '*$DOMAIN/api/*' } }],
      actions: [{ id: 'disable_security' }, { id: 'security_level', value: 'essentially_off' }, { id: 'browser_check', value: 'off' }],
      status: 'active'
    },
    lpCache: {
      targets: [{ target: 'url', constraint: { operator: 'matches', value: 'lp.$DOMAIN/*' } }],
      actions: [
        { id: 'ssl', value: 'full' },
        { id: 'cache_level', value: 'cache_everything' },
        { id: 'edge_cache_ttl', value: 172800 }
      ],
      status: 'active'
    },
    dataExportCache: {
      targets: [{ target: 'url', constraint: { operator: 'matches', value: 'https://www.$DOMAIN/export/*' } }],
      actions: [{ id: 'cache_level', value: 'bypass' }],
      status: 'active'
    },
    rootForward: {
      targets: [{ target: 'url', constraint: { operator: 'matches', value: 'https://$DOMAIN/*' } }],
      actions: [{ id: 'forwarding_url', value: { status_code: 301, url: 'https://www.$DOMAIN/$1' } }],
      status: 'active'
    },
    ia: {
      targets: [{ target: 'url', constraint: { operator: 'matches', value: '*ia.$DOMAIN/*' } }],
      actions: [{ id: 'disable_security' }, { id: 'cache_level', value: 'bypass' }],
      status: 'active'
    }
  },
  network: {
    http2: 'on',
    http3: 'on',
    '0-RTT': 'on',
    ipV6: 'off'
  },
  traffic: {
    argoSmartRouting: 'on'
  },
  scrapeShield: {
    hotlinkProtection: 'off'
  }
}
