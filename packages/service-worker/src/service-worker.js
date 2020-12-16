/* eslint-disable @scandipwa/scandipwa-guidelines/export-level-one */
/* eslint-disable no-restricted-globals */

// This service worker can be customized!
// See https://developers.google.com/web/tools/workbox/modules
// for the list of available Workbox modules, or add any other
// code you'd like.
// You can also remove this file if you'd prefer not to use a
// service worker, and the Workbox build step will be skipped.

import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate } from 'workbox-strategies';

const RESPONSE_OK = 200;

clientsClaim();

// Precache all of the assets generated by your build process.
// Their URLs are injected into the manifest variable below.
// This variable must be present somewhere in your service worker file,
// even if you decide not to use precaching. See https://cra.link/PWA
precacheAndRoute(self.__WB_MANIFEST);

// Set up App Shell-style routing, so that all navigation requests
// are fulfilled with your index.html shell. Learn more at
// https://developers.google.com/web/fundamentals/architecture/app-shell
export const fileExtensionRegexp = new RegExp('/[^/?]+\\.[^/]+$');

registerRoute(
    // Return false to exempt requests from being fulfilled by index.html.
    ({ request, url }) => {
        if (navigator.onLine) {
            // If we are online - do not respond from cache
            return false;
        }

        if (request.mode !== 'navigate') {
            // If this isn't a navigation, skip.
            return false;
        }

        if (url.pathname.startsWith('/_')) {
            // If this is a URL that starts with /_, skip.
            return false;
        }

        if (url.pathname.match(fileExtensionRegexp)) {
            // If this looks like a URL for a resource, because it contains // a file extension, skip.
            return false;
        }

        // Return true to signal that we want to use the handler.
        return true;
    },
    createHandlerBoundToURL(`${ process.env.PUBLIC_URL }/index.html`)
);

// Cache same-origin image requests
registerRoute(
    ({ url }) => (
        url.origin === self.location.origin
        // cache png, gif, jpeg, jpg in image cache
        && /.(jpe?g|png|gif)$/.test(url.pathname)
    ),
    new StaleWhileRevalidate({
        cacheName: 'images',
        plugins: [
            // Ensure that once this runtime cache reaches a maximum size the
            // least-recently used images are removed.
            new ExpirationPlugin({ maxEntries: 50 })
        ]
    })
);

const makeRequestAndUpdateCache = async (request, cache) => {
    const response = await fetch(request);
    const isValid = response.status === RESPONSE_OK;
    const responseToCache = response.clone();

    if (isValid) {
        cache.put(request.url, responseToCache);
    }

    return response;
};

registerRoute(
    /\/graphql/,
    async ({ event }) => {
        const { request } = event;
        const cache = await caches.open('graphql');
        const hasResponse = await cache.has(request);

        if (!hasResponse) {
            // if there is no cached response (notice, we return promise)
            event.respondWith(makeRequestAndUpdateCache(request, cache));
        }

        // Give imidiate response & revalidate it (notice, we return promise)
        event.respondWith(cache.match(request));

        const type = request.headers.get('Application-Model');
        const revalidatedResponse = await makeRequestAndUpdateCache(request, cache);
        const responseClone = revalidatedResponse.clone();

        const broadcast = new BroadcastChannel(type);
        broadcast.postMessage({ payload: await responseClone.json(), type });
        broadcast.close();
    }
);

// This allows the web app to trigger skipWaiting via
// registration.waiting.postMessage({type: 'SKIP_WAITING'})
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
