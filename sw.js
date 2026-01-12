
// Simple service worker that doesn't cache HTML
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    return caches.delete(cacheName);
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Only cache external resources, not HTML
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // Don't cache HTML pages
    if (event.request.headers.get('Accept')?.includes('text/html')) {
        return;
    }
    
    // Only cache CSS, JS, and fonts from CDN
    if (url.pathname.endsWith('.css') || 
        url.pathname.endsWith('.js') || 
        url.hostname.includes('cdnjs.cloudflare.com')) {
        
        event.respondWith(
            caches.open('drama-watch-assets').then((cache) => {
                return cache.match(event.request).then((response) => {
                    return response || fetch(event.request).then((response) => {
                        cache.put(event.request, response.clone());
                        return response;
                    });
                });
            })
        );
    }
});
