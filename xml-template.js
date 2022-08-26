/* eslint-disable */
async function handleRequest (request) {
  const init = {
    headers: {
      'content-type': 'application/xml; charset=UTF-8'
    }
  }
  return new Response(sitemapXML, init)
}

addEventListener('fetch', event => {
  return event.respondWith(handleRequest(event.request))
})

const sitemapXML = `XML_REPLACE_TAG`