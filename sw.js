const CACHE = 'sgou-v5';
const SHELL = ['./', './index.html', './style.css', './script.js', './manifest.json', './icon.svg'];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
    e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;
    const url = new URL(e.request.url);

    // API (download proxy): network-only, never cache
    if (url.pathname.startsWith('/api/')) return;

    // Fonts: stale-while-revalidate
    if (FONT_HOSTS.some(h => url.hostname === h)) { e.respondWith(swr(e.request)); return; }

    // JSON data: network-first
    if (url.pathname.endsWith('.json')) { e.respondWith(nf(e.request)); return; }

    // App shell: stale-while-revalidate
    if (url.origin === self.location.origin) { e.respondWith(swr(e.request)); return; }

    // Everything else: network-only
    e.respondWith(fetch(e.request).catch(() => new Response('Offline', { status: 503 })));
});

async function nf(req) {
    try {
        const r = await fetch(req);
        if (r.ok) { const c = await caches.open(CACHE); c.put(req, r.clone()); }
        return r;
    } catch (_) { return (await caches.match(req)) || new Response('[]', { headers: { 'Content-Type': 'application/json' } }); }
}

async function swr(req) {
    const c = await caches.open(CACHE);
    const cached = await c.match(req);
    const fp = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => cached);
    return cached || fp;
}
