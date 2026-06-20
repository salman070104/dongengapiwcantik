// Dongeng Pengantar Tidur Api Cantik - Service Worker
const CACHE_NAME = 'dongeng-ceria-v7';
const ASSETS_TO_CACHE = [
    '/images/hero-characters.png',
    '/images/story-kelinci.png',
    '/images/story-bintang.png',
    '/images/story-itik.png',
    '/images/story-rusa.png',
    '/images/icon-192.png',
    '/images/icon-512.png'
];

// Install - Cache gambar saja (bukan HTML/CSS/JS agar selalu fresh)
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS_TO_CACHE))
            .catch(err => console.log('Cache install error:', err))
    );
    self.skipWaiting();
});

// Activate - Hapus SEMUA cache lama dan ambil alih semua tab
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            // Paksa semua tab pakai SW baru
            return self.clients.claim();
        }).then(() => {
            // Kirim pesan ke semua tab untuk reload
            return self.clients.matchAll({ type: 'window' });
        }).then(clients => {
            clients.forEach(client => {
                client.postMessage({ type: 'SW_UPDATED' });
            });
        })
    );
});

// Fetch Strategy:
// - HTML/CSS/JS → Network first (selalu ambil yang terbaru), fallback cache
// - Gambar → Cache first (hemat bandwidth), fallback network
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // Hanya handle request dari origin kita sendiri
    if (url.origin !== location.origin) return;
    
    const isAsset = /\.(png|jpg|jpeg|gif|svg|webp|ico)$/i.test(url.pathname);
    
    if (isAsset) {
        // Cache first untuk gambar
        event.respondWith(
            caches.match(event.request).then(cached => {
                return cached || fetch(event.request).then(response => {
                    if (response && response.status === 200) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    }
                    return response;
                });
            }).catch(() => caches.match(event.request))
        );
    } else {
        // Network first untuk HTML, CSS, JS (selalu ambil terbaru)
        event.respondWith(
            fetch(event.request).then(response => {
                if (response && response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => caches.match(event.request))
        );
    }
});
