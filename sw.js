/**
 * Service Worker for Mutuelle Calculateur
 * Provides offline functionality and caching
 */

const CACHE_NAME = 'mutuelle-calculateur-v1.0.0';
const CACHE_EXPIRY_TIME = 24 * 60 * 60 * 1000; // 24 hours

// Files to cache for offline functionality
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/styles/main.css',
    '/js/app.js',
    '/pages/mentions.html',
    '/pages/confidentialite.html',
    '/pages/cgu.html',
    '/pages/contact.html',
    '/manifest.json'
];

// External CDN resources to cache
const CDN_RESOURCES = [
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

// Install event - cache static assets
self.addEventListener('install', event => {
    console.log('Service Worker: Installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Service Worker: Caching static assets');
                // Cache static assets first
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                // Then cache CDN resources
                return caches.open(CACHE_NAME + '-cdn');
            })
            .then(cache => {
                console.log('Service Worker: Caching CDN resources');
                return Promise.allSettled(
                    CDN_RESOURCES.map(url => 
                        cache.add(url).catch(err => 
                            console.warn(`Failed to cache ${url}:`, err)
                        )
                    )
                );
            })
            .then(() => {
                console.log('Service Worker: Installation complete');
                return self.skipWaiting();
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    console.log('Service Worker: Activating...');
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME && cacheName !== CACHE_NAME + '-cdn') {
                        console.log('Service Worker: Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('Service Worker: Activation complete');
            return self.clients.claim();
        })
    );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', event => {
    // Only handle GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // Skip cross-origin requests we don't cache
    if (!event.request.url.startsWith(self.location.origin) && 
        !CDN_RESOURCES.some(url => event.request.url.startsWith(url.split('/').slice(0, 3).join('/')))) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Return cached version if available
                if (response) {
                    // Check if cached resource is expired (for CDN resources)
                    if (CDN_RESOURCES.some(url => event.request.url.includes(url))) {
                        const cachedTime = response.headers.get('sw-cache-time');
                        if (cachedTime && (Date.now() - parseInt(cachedTime)) > CACHE_EXPIRY_TIME) {
                            // Expired, try to fetch fresh version
                            return fetchAndCache(event.request).catch(() => response);
                        }
                    }
                    return response;
                }

                // Not in cache, try to fetch
                return fetchAndCache(event.request);
            })
            .catch(() => {
                // Network failed, return offline page for navigation requests
                if (event.request.mode === 'navigate') {
                    return caches.match('/index.html');
                }
                
                // For other requests, return a basic offline response
                return new Response('Offline - Resource not available', {
                    status: 503,
                    statusText: 'Service Unavailable',
                    headers: { 'Content-Type': 'text/plain' }
                });
            })
    );
});

// Helper function to fetch and cache resources
async function fetchAndCache(request) {
    const response = await fetch(request);
    
    // Only cache successful responses
    if (response.status === 200) {
        const cacheName = CDN_RESOURCES.some(url => request.url.includes(url)) ? 
            CACHE_NAME + '-cdn' : CACHE_NAME;
        
        const cache = await caches.open(cacheName);
        
        // Clone response and add timestamp for CDN resources
        if (cacheName === CACHE_NAME + '-cdn') {
            const responseClone = response.clone();
            const headers = new Headers(responseClone.headers);
            headers.set('sw-cache-time', Date.now().toString());
            
            const modifiedResponse = new Response(await responseClone.blob(), {
                status: responseClone.status,
                statusText: responseClone.statusText,
                headers: headers
            });
            
            cache.put(request, modifiedResponse);
        } else {
            cache.put(request, response.clone());
        }
    }
    
    return response;
}

// Handle background sync (for form submissions)
self.addEventListener('sync', event => {
    if (event.tag === 'contact-form') {
        event.waitUntil(
            // Handle queued form submissions when back online
            syncContactForm()
        );
    }
});

// Message handling for cache updates
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'GET_CACHE_SIZE') {
        getCacheSize().then(size => {
            event.ports[0].postMessage({ cacheSize: size });
        });
    }
});

// Helper functions
async function syncContactForm() {
    // Implementation for syncing form data when back online
    // This would be used if we store form submissions for offline use
    console.log('Service Worker: Syncing contact form data');
}

async function getCacheSize() {
    const cacheNames = await caches.keys();
    let totalSize = 0;
    
    for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const requests = await cache.keys();
        
        for (const request of requests) {
            const response = await cache.match(request);
            if (response) {
                const blob = await response.blob();
                totalSize += blob.size;
            }
        }
    }
    
    return totalSize;
}

// Notification handling (for future features)
self.addEventListener('notificationclick', event => {
    console.log('Notification clicked');
    event.notification.close();
    
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(clientList => {
            if (clientList.length > 0) {
                return clientList[0].focus();
            }
            return clients.openWindow('/');
        })
    );
});

// Error handling
self.addEventListener('error', event => {
    console.error('Service Worker error:', event.error);
});

self.addEventListener('unhandledrejection', event => {
    console.error('Service Worker unhandled rejection:', event.reason);
    event.preventDefault();
});

console.log('Service Worker: Loaded successfully');