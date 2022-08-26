/* eslint-disable */
async function handleRequest (request) {
  const init = {
    headers: {
      'content-type': 'text/plain; charset=UTF-8',
    }
  }
  return new Response(someHTML, init)
}

addEventListener('fetch', event => {
  return event.respondWith(handleRequest(event.request))
})

const someHTML = `TXT_REPLACE_TAG`