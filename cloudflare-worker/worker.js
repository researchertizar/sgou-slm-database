// ============================================================================
// SGOU PDF Download & Streaming Proxy (Cloudflare Worker)
// - 100% Free: Cloudflare Workers free plan gives 100,000 req/day & UNLIMITED egress!
// - Zero bandwidth cost to your Vercel deployment.
// - Supports Range requests for fast PDF.js page streaming.
// - Strict hostname allowlisting prevents SSRF.
// ============================================================================

const ALLOWED_HOSTS = new Set([
  'd198y4z1gpgoxg.cloudfront.net',
  'sgou.ac.in',
  'www.sgou.ac.in'
]);

export default {
  async fetch(request, env, ctx) {
    // 1. CORS Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Range, Content-Type',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    if (request.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // 2. Validate URL parameter
    const urlObj = new URL(request.url);
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

    // 3. Derive & sanitize filename
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

    // 4. Fetch upstream with streaming & Range support
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);

      const fetchHeaders = { 'User-Agent': 'SGOU-Cloudflare-Proxy/1.0' };
      const clientRange = request.headers.get('range');
      if (clientRange) {
        fetchHeaders['Range'] = clientRange;
      }

      const upstream = await fetch(raw, {
        signal: controller.signal,
        headers: fetchHeaders,
        cf: {
          cacheTtl: 604800,
          cacheEverything: true
        }
      });
      clearTimeout(timer);

      if (!upstream.ok && upstream.status !== 206) {
        return Response.redirect(parsed.href, 302);
      }

      const userAgent = request.headers.get('user-agent') || '';
      const isIOS = /iPhone|iPad|iPod/i.test(userAgent) || urlObj.searchParams.get('inline') === '1';
      const disposition = isIOS ? 'inline' : 'attachment';

      const headers = new Headers();
      headers.set('Content-Type', 'application/pdf');
      headers.set('Content-Disposition', `${disposition}; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Disposition, Content-Range, Accept-Ranges');
      headers.set('Cache-Control', 'public, max-age=86400, s-maxage=604800');
      headers.set('X-Content-Type-Options', 'nosniff');
      headers.set('Content-Security-Policy', "default-src 'none'");

      const cl = upstream.headers.get('content-length');
      if (cl) headers.set('Content-Length', cl);
      const cr = upstream.headers.get('content-range');
      if (cr) headers.set('Content-Range', cr);
      const ar = upstream.headers.get('accept-ranges');
      if (ar) headers.set('Accept-Ranges', ar);

      return new Response(upstream.body, {
        status: upstream.status,
        headers
      });

    } catch (err) {
      return Response.redirect(parsed.href, 302);
    }
  }
};
