// service-worker.js

const CACHE_NAME = 'discipline-tracker-v1';  // ← change to v2, v3 etc. when you update files

// List of files to cache (add ALL important files here)
const STATIC_ASSETS = [
  '/',                    // root → redirects to index.html
  '/index.html',
  '/admin.html',          // if you have it
  '/stats.html',
  '/history.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/icon-192.png',        // ← use your actual icon names
  '/icon-512.png'
  // add more if you have fonts, other images, etc.
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching app shell');
        return cache.addAll(STATIC_ASSETS);
      })
      .catch(err => console.error('Cache addAll failed:', err))
  );
  // Skip waiting → new SW activates right away
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    })
  );
  // Take control of all open tabs immediately
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Return cache if found
        if (cachedResponse) {
          return cachedResponse;
        }

        // Otherwise fetch from network
        return fetch(event.request).then(networkResponse => {
          // Don't cache failed or non-200 responses
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }

          // Clone and cache the successful response
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });

          return networkResponse;
        }).catch(() => {
          // Optional: offline fallback (you can add later)
          // return caches.match('/offline.html');
        });
      })
  );
});
