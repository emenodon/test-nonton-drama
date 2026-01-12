
const CACHE_NAME = 'drama-watch-v1';
const REPO_NAME = 'test-nonton-drama';
const BASE_PATH = REPO_NAME ? '/' + REPO_NAME + '/' : '/';

const ASSETS_TO_CACHE = [
    BASE_PATH,
    BASE_PATH + 'style.min.css',
    BASE_PATH + 'app.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Caching assets:', ASSETS_TO_CACHE);
                return cache.addAll(ASSETS_TO_CACHE);
            })
    );
});

self.addEventListener('fetch', (event) => {
    // Skip API requests
    if (event.request.url.includes('/api/') || event.request.url.includes('melolo-api')) {
        return;
    }
    
    // Skip external resources
    if (event.request.url.includes('cdnjs.cloudflare.com') || 
        event.request.url.includes('melolo-api-azure.vercel.app') ||
        event.request.url.includes('images.weserv.nl')) {
        return fetch(event.request);
    }
    
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                
                // Clone the request because it can only be used once
                const fetchRequest = event.request.clone();
                
                return fetch(fetchRequest).then(response => {
                    // Check if valid response
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }
                    
                    // Clone the response because it can only be used once
                    const responseToCache = response.clone();
                    
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                    
                    return response;
                });
            })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys => 
            Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            )
        )
    );
});
