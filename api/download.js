// ===============================
//  SGOU PDF Download Proxy
//  Validates URL against allowlist,
//  fetches PDF, returns with CORS +
//  Content-Disposition for true download
// ===============================

const ALLOWED_HOSTS = new Set([
    'd198y4z1gpgoxg.cloudfront.net',
    'sgou.ac.in',
    'www.sgou.ac.in'
]);

const MAX_SIZE = 48 * 1024 * 1024; // 48 MB safety cap

export default async function handler(req, res) {
    // --- CORS ---
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // --- Validate URL ---
    const raw = req.query.url;
    if (!raw || typeof raw !== 'string') {
        return res.status(400).json({ error: 'Missing url parameter' });
    }

    let parsed;
    try {
        parsed = new URL(raw);
    } catch {
        return res.status(400).json({ error: 'Invalid URL' });
    }

    if (!ALLOWED_HOSTS.has(parsed.hostname)) {
        return res.status(403).json({ error: 'Host not allowed' });
    }

    // --- Fetch upstream ---
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 25000);

        const upstream = await fetch(raw, {
            signal: controller.signal,
            headers: { 'User-Agent': 'SGOU-PDF-Proxy/1.0' }
        });
        clearTimeout(timer);

        if (!upstream.ok) {
            return res.status(502).json({ error: `Upstream returned ${upstream.status}` });
        }

        // Size guard
        const cl = upstream.headers.get('content-length');
        if (cl && parseInt(cl, 10) > MAX_SIZE) {
            return res.status(413).json({ error: 'File exceeds size limit' });
        }

        // --- Derive filename ---
        const segs = parsed.pathname.split('/').filter(Boolean);
        let filename = segs[segs.length - 1] || 'document.pdf';
        if (!filename.toLowerCase().endsWith('.pdf')) filename += '.pdf';

        // --- Stream response ---
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800');
        res.setHeader('X-Content-Type-Options', 'nosniff');

        const buf = await upstream.arrayBuffer();
        return res.send(Buffer.from(buf));

    } catch (err) {
        if (err.name === 'AbortError') {
            return res.status(504).json({ error: 'Upstream timeout' });
        }
        return res.status(500).json({ error: 'Proxy error' });
    }
}
