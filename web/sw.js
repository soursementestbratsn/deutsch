// Deutsch Quest — Service Worker for offline support
const CACHE_NAME = 'dq-v1';
const STATIC_ASSETS = [
  '/',
  '/web/index.html',
  '/web/style.css',
  '/web/glass.css',
  '/web/nav.css',
  '/web/train.css',
  '/web/reading.css',
  '/web/extras.css',
  '/web/stats.css',
  '/web/dict.css',
  '/web/dq.js',
  '/web/nav.js',
  '/web/glass.js',
  '/web/theme.js',
  '/web/settings.js',
  '/web/games.js',
  '/web/worksheets.js',
  '/web/reading.js',
  '/web/tables.js',
  '/web/sounds.js',
  '/web/learn.js',
  '/web/course.js',
  '/web/grammar.js',
  '/web/grammar-view.js',
  '/web/speech.js',
  '/web/modes.js',
  '/web/content.js',
  '/web/ideas.js',
  '/web/fx.js',
  '/web/sound.js',
  '/web/phonetics.js',
  '/web/wordpop.js',
  '/web/mywords.js',
  '/web/dict.js',
  '/web/train.js',
  '/web/extras.js',
  '/web/dq-ui.js',
  '/web/train/data-a0.js',
  '/web/train/data-a1.js',
  '/web/train/data-a2.js',
  '/web/train/data-b1.js',
  '/web/course/lessons-1.js',
  '/web/course/lessons-2.js',
  '/web/course/lessons-3.js',
  '/manifest.json'
];

// Install - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch - cache first for static assets, network first for API
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip chrome-extension, etc.
  if (!url.protocol.startsWith('http')) return;
  
  // API requests - network first, fallback to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache successful GET API responses
          if (response.ok && event.request.method === 'GET') {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }
  
  // Static assets - cache first
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Return cached version immediately
          return cachedResponse;
        }
        // Fetch from network
        return fetch(event.request)
          .then((response) => {
            // Cache successful responses
            if (response.ok) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
            }
            return response;
          })
          .catch(() => {
            // Offline fallback for HTML pages
            if (event.request.mode === 'navigate') {
              return caches.match('/web/index.html');
            }
          });
      })
  );
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});