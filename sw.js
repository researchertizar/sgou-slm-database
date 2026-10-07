const CACHE = 'sgou-v138';
const SHELL = [
    './',
    './index.html',
    './style.css?v=20261007_02',
    './script.js?v=20261007_02',
    './manifest.json?v=20261007_02',
    './icon.svg?v=20260904_10',
    './icon-192.png?v=20260904_10',
    './icon-512.png?v=20260904_10',
    './apple-touch-icon.png?v=20260904_10',
    './favicon-32x32.png?v=20260904_10',
    './view.html',
    './reader.html',
    './pdfjs/pdf.min.js',
    './pdfjs/pdf.worker.min.js',
    './opensearch.xml'
];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE)
            .then(c => c.addAll(SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys()
            .then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== 'sgou-offline-docs').map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('message', e => {
    if (e.data && e.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;
    const url = new URL(e.request.url);

    // Never cache analytics / tracking / ads
    if (
        url.hostname === 'www.googletagmanager.com' ||
        url.hostname === 'www.google-analytics.com' ||
        url.hostname === 'analytics.google.com' ||
        url.hostname.endsWith('.google-analytics.com') ||
        url.hostname === 'region1.google-analytics.com' ||
        url.hostname === 'stats.g.doubleclick.net' ||
        url.hostname === 'pagead2.googlesyndication.com'
    ) return;

    if (url.pathname.startsWith('/api/')) return;

    // Manifest bypass: Android WebAPK minting and mobile browsers must receive fresh manifest to detect app name/icon updates
    if (url.pathname.endsWith('/manifest.json') || url.pathname === '/manifest.json') {
        e.respondWith(
            fetch(e.request, { cache: 'no-cache' })
                .catch(async () => (await caches.match(e.request)) || new Response('Offline', { status: 503 }))
        );
        return;
    }

    // App icons & touch icons bypass / revalidate
    if (url.pathname.match(/\/(icon.*|apple-touch-icon.*|favicon.*)/)) {
        e.respondWith(
            fetch(e.request)
                .then(r => {
                    if (r && (r.ok || r.type === 'opaque')) {
                        const clone = r.clone();
                        caches.open(CACHE).then(c => c.put(e.request, clone));
                    }
                    return r;
                })
                .catch(async () => (await caches.match(e.request)) || new Response('Offline', { status: 503 }))
        );
        return;
    }

    // Navigation requests: HTML SPA Routing fallback (ensures offline deep links always load app shell)
    if (e.request.mode === 'navigate') {
        e.respondWith(
            fetch(e.request).catch(async () => {
                const c = await caches.open(CACHE);
                return (await c.match(e.request)) ||
                       (await c.match(e.request, { ignoreSearch: true })) ||
                       (await c.match('./index.html')) ||
                       (await c.match('./')) ||
                       new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/html' } });
            })
        );
        return;
    }

    if (FONT_HOSTS.some(h => url.hostname === h)) {
        e.respondWith(swr(e.request));
        return;
    }

    if (url.pathname.endsWith('.json')) {
        e.respondWith(swr(e.request));
        return;
    }

    if (url.origin === self.location.origin) {
        e.respondWith(swr(e.request));
        return;
    }

    e.respondWith(fetch(e.request).catch(() => new Response('Offline', { status: 503 })));
});

async function swr(req) {
    const c = await caches.open(CACHE);
    const cached = (await c.match(req)) || (await c.match(req, { ignoreSearch: true }));
    if (cached) {
        fetch(req)
            .then(r => {
                if (r && (r.ok || r.type === 'opaque')) {
                    c.put(req, r.clone());
                }
            })
            .catch(() => {});
        return cached;
    }

    try {
        const res = await fetch(req);
        if (res && (res.ok || res.type === 'opaque')) {
            c.put(req, res.clone());
        }
        return res;
    } catch {
        return new Response('Network unavailable or blocked', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' }
        });
    }
}
