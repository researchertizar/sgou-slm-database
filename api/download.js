// ===============================
//  SGOU PDF Download Proxy (Vercel Edge Runtime)
//  - 100% Free-of-cost operation
//  - Streams upstream.body directly (no memory buffering)
//  - Bypasses 4.5 MB payload limit via Web Streams
//  - Handles any file size without crashing
//  - Zero-cost CDN redirect fallback
// ===============================

export const config = {
    runtime: 'edge'
};

const ALLOWED_HOSTS = new Set([
    'd198y4z1gpgoxg.cloudfront.net',
    'sgou.ac.in',
    'www.sgou.ac.in'
]);

export default async function handler(req) {
    // --- CORS Preflight ---
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Max-Age': '86400'
            }
        });
    }

    if (req.method !== 'GET') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }

    // --- Validate URL ---
    const urlObj = new URL(req.url);
    const raw = urlObj.searchParams.get('url');
    const customFilename = urlObj.searchParams.get('filename');

    if (!raw || typeof raw !== 'string') {
        return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }

    let parsed;
    try {
        parsed = new URL(raw);
    } catch {
        return new Response(JSON.stringify({ error: 'Invalid URL' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }

    if (parsed.protocol !== 'https:') {
        return new Response(JSON.stringify({ error: 'HTTPS protocol required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }

    if (!ALLOWED_HOSTS.has(parsed.hostname.toLowerCase())) {
        return new Response(JSON.stringify({ error: 'Host not allowed' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }

    // --- Derive and sanitize filename against header injection & path traversal ---
    let filename = (customFilename || '')
        .replace(/[\r\n\x00-\x1f\x7f/\\]/g, '')
        .replace(/\.\.+/g, '')
        .trim();

    if (!filename) {
        const segs = parsed.pathname.split('/').filter(Boolean);
        filename = (segs[segs.length - 1] || 'document.pdf')
            .replace(/[\r\n\x00-\x1f\x7f/\\]/g, '')
            .trim();
    }
    if (!filename.toLowerCase().endsWith('.pdf')) filename += '.pdf';

    // --- Fetch upstream with streaming ---
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);

        const upstream = await fetch(raw, {
            signal: controller.signal,
            headers: { 'User-Agent': 'SGOU-PDF-Proxy/2.0' }
        });
        clearTimeout(timer);

        if (!upstream.ok) {
            // Direct redirect fallback to ensure user still gets the file
            return Response.redirect(raw, 302);
        }

        const userAgent = req.headers.get('user-agent') || '';
        const isIOS = /iPhone|iPad|iPod/i.test(userAgent) || urlObj.searchParams.get('inline') === '1';
        const disposition = isIOS ? 'inline' : 'attachment';

        const headers = new Headers();
        headers.set('Content-Type', 'application/pdf');
        headers.set('Content-Disposition', `${disposition}; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
        headers.set('Access-Control-Allow-Origin', '*');
        headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Disposition');
        headers.set('Cache-Control', 'public, max-age=86400, s-maxage=604800');
        headers.set('X-Content-Type-Options', 'nosniff');
        headers.set('Content-Security-Policy', "default-src 'none'");

        const cl = upstream.headers.get('content-length');
        if (cl) headers.set('Content-Length', cl);

        // Stream body directly without buffering in RAM
        return new Response(upstream.body, {
            status: 200,
            headers
        });

    } catch (err) {
        // On any timeout or edge error, fallback to direct CDN redirect
        return Response.redirect(raw, 302);
    }
}

/*
 * ========================================================
 * BLUEPRINT: Free Cloudflare Worker (Optional Alternative)
 * If you ever wish to run this on Cloudflare's free plan
 * (100,000 requests/day, completely free with 0 egress cost):
 * --------------------------------------------------------
 * export default {
 *   async fetch(request) {
 *     const url = new URL(request.url).searchParams.get('url');
 *     const filename = new URL(request.url).searchParams.get('filename') || 'document.pdf';
 *     if (!url) return new Response('Missing url', { status: 400 });
 *     const res = await fetch(url);
 *     const h = new Headers(res.headers);
 *     h.set('Content-Disposition', `attachment; filename="${filename}"`);
 *     h.set('Access-Control-Allow-Origin', '*');
 *     return new Response(res.body, { status: res.status, headers: h });
 *   }
 * }
 * ========================================================
 */
