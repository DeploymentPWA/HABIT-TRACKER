// service-worker.js
const CACHE_NAME = 'discipline-tracker-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/admin.html',
  '/stats.html',
  '/history.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/icon.png',           // ← change to your actual icon filename
  // add more static files if you have them (fonts, images, etc.)
];

// Install event - cache core app files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching app shell');
        return cache.addAll(STATIC_ASSETS);
      })
      .catch(err => console.error('Caching failed:', err))
  );

  // Skip waiting so the new SW activates immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    })
  );

  // Take control of the page immediately
  self.clients.claim();
});

// Fetch event - serve from cache first, then network (cache-first strategy for static assets)
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and requests to external APIs (if any)
  if (event.request.method !== 'GET' || event.request.url.includes('chrome-extension')) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Return cached response if found
        if (cachedResponse) {
          return cachedResponse;
        }

        // Otherwise fetch from network
        return fetch(event.request).then((networkResponse) => {
          // Don't cache non-successful responses or non-200 status
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }

          // Clone and cache the response
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });

          return networkResponse;
        });
      })
      .catch(() => {
        // Optional: fallback page for offline (you can add later)
        // return caches.match('/offline.html');
      })
  );
});

// Optional: Background sync (if you want to add later for saving logs when offline)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-logs') {
    event.waitUntil(syncLogs());
  }
});

// Placeholder for future background sync logic
async function syncLogs() {
  // You can implement this later if needed
  console.log('Background sync: logs would be sent here');
}
