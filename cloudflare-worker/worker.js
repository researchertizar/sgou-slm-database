// ============================================================================
// SGOU Academic Database — Cloudflare Worker (Zero-Cost Edge Gateway)
// 1. PDF Streaming & Download Proxy (Supports Range requests & CloudFront streaming)
// 2. High-Precision UX Telemetry Ingestion (/api/telemetry -> Cloudflare D1)
// 3. Analytics Dashboard Query API (/api/analytics/query -> D1 SQLite)
// - 100% Free Forever: 100,000 req/day, 5M reads/day, 10GB storage, 0 bandwidth cost.
// ============================================================================

const ALLOWED_HOSTS = new Set([
  'd198y4z1gpgoxg.cloudfront.net',
  'sgou.ac.in',
  'www.sgou.ac.in'
]);

const ALLOWED_ORIGINS = new Set([
  'https://sgou-slm-database.vercel.app',
  'https://sgou-database.vercel.app',
  'https://sgou.ac.in',
  'https://www.sgou.ac.in'
]);

function getCorsOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return '*'; // Direct browser navigation or non-browser client
  try {
    const parsed = new URL(origin);
    const host = parsed.hostname.toLowerCase();
    if (ALLOWED_ORIGINS.has(origin.toLowerCase())) return origin;
    if (host === 'localhost' || host === '127.0.0.1') return origin;
  } catch (_) {}
  return null; // Disallowed origin
}

export default {
  async fetch(request, env, ctx) {
    const corsOrigin = getCorsOrigin(request);
    if (!corsOrigin) {
      return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const corsHeaders = {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin'
    };

    // 1. CORS Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const urlObj = new URL(request.url);
    const pathname = urlObj.pathname;

    // ========================================================================
    // 2. INGESTION ROUTE: /api/telemetry (POST)
    // ========================================================================
    if (pathname === '/api/telemetry' && request.method === 'POST') {
      try {
        const payload = await request.json();
        const { sid, profile = {}, events = [] } = payload;
        if (!sid) {
          return new Response(JSON.stringify({ error: 'Missing session ID' }), { status: 400, headers: corsHeaders });
        }

        const cf = request.cf || {};

        // If Cloudflare D1 is bound, execute batch writes
        if (env && env.DB) {
          const sessionStmt = env.DB.prepare(`
            INSERT INTO telemetry_sessions (
              session_id, country, region, city, postal_code, latitude, longitude,
              isp, colo, device_type, screen_res, viewport, dpr, ram_gb, cpu_cores,
              touch, is_pwa, network_type, downlink_mbps, rtt_ms, save_data, theme, last_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(session_id) DO UPDATE SET
              last_active = CURRENT_TIMESTAMP,
              network_type = excluded.network_type,
              downlink_mbps = excluded.downlink_mbps,
              rtt_ms = excluded.rtt_ms,
              theme = excluded.theme
          `).bind(
            sid,
            cf.country || 'IN',
            cf.region || 'Unknown',
            cf.city || 'Unknown',
            cf.postalCode || null,
            cf.latitude || null,
            cf.longitude || null,
            cf.asOrganization || 'Unknown',
            cf.colo || 'Unknown',
            profile.touch ? 'mobile' : 'desktop',
            profile.screen || null,
            profile.viewport || null,
            profile.dpr || 1,
            profile.ram_gb || null,
            profile.cores || null,
            profile.touch ? 1 : 0,
            profile.pwa ? 1 : 0,
            profile.net_type || 'unknown',
            profile.downlink || null,
            profile.rtt || null,
            profile.save_data ? 1 : 0,
            profile.theme || 'dark'
          );

          const eventStmt = env.DB.prepare(`
            INSERT INTO telemetry_events (session_id, event_type, page_url, time_offset_ms, selector, text_snippet, details_json)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `);

          const dbBatch = [sessionStmt];

          for (const evt of events) {
            const d = evt.d || {};
            dbBatch.push(eventStmt.bind(
              sid,
              evt.t || 'generic',
              evt.url || '/',
              evt.ts || 0,
              d.selector || d.el || d.tag || null,
              d.text || null,
              JSON.stringify(d)
            ));

            // Track Zero-Searches
            if (evt.t === 'zero_search' && d.q) {
              dbBatch.push(env.DB.prepare(`
                INSERT INTO zero_search_ledger (query, category, hit_count, last_searched)
                VALUES (?, ?, 1, CURRENT_TIMESTAMP)
                ON CONFLICT(query) DO UPDATE SET hit_count = hit_count + 1, last_searched = CURRENT_TIMESTAMP
              `).bind(String(d.q).trim().toLowerCase(), d.tab || 'ALL'));
            }

            // Track Rage Clicks
            if (evt.t === 'rage_click' && d.selector) {
              dbBatch.push(env.DB.prepare(`
                INSERT INTO rage_click_ledger (element_selector, text_sample, rage_count, last_rage)
                VALUES (?, ?, 1, CURRENT_TIMESTAMP)
                ON CONFLICT(element_selector) DO UPDATE SET rage_count = rage_count + 1, last_rage = CURRENT_TIMESTAMP
              `).bind(String(d.selector).slice(0, 100), String(d.text || '').slice(0, 50)));
            }

            // Track Reading Dwell
            if (evt.t === 'reader_page_dwell' && d.course_code) {
              dbBatch.push(env.DB.prepare(`
                INSERT INTO reading_dwell_ledger (session_id, course_code, page_number, dwell_seconds)
                VALUES (?, ?, ?, ?)
              `).bind(sid, d.course_code, d.page || 1, d.duration_ms ? (d.duration_ms / 1000) : 0));
            }
          }

          if (ctx && ctx.waitUntil) {
            ctx.waitUntil(env.DB.batch(dbBatch));
          } else {
            await env.DB.batch(dbBatch);
          }
        }

        return new Response(JSON.stringify({ ok: true, received: events.length }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // ========================================================================
    // 3. DASHBOARD QUERY ROUTE: /api/analytics/query (GET or POST)
    // ========================================================================
    if (pathname === '/api/analytics/query') {
      // Validate Authorization token
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.replace(/^Bearer\s+/i, '') || urlObj.searchParams.get('token');
      const expectedToken = (env && env.ADMIN_SECRET) || 'sgou_telemetry_secret';

      if (!token || token !== expectedToken) {
        return new Response(JSON.stringify({ error: 'Unauthorized: Invalid or missing token' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const action = urlObj.searchParams.get('action') || 'overview';

      if (!env || !env.DB) {
        // Mock payload if D1 not yet bound in environment
        return new Response(JSON.stringify({
          status: 'd1_unbound_mock',
          overview: { total_sessions: 1420, today_sessions: 185, active_last_hour: 28, zero_searches_count: 14, rage_clicks_count: 8 },
          geo: [{ region: 'Kerala', city: 'Kollam', count: 540 }, { region: 'Kerala', city: 'Thiruvananthapuram', count: 320 }, { region: 'Kerala', city: 'Ernakulam', count: 210 }, { region: 'Kerala', city: 'Kozhikode', count: 180 }],
          zero_searches: [{ query: 'fyug semester 3 syllabus', category: 'FYUG', hit_count: 42 }, { query: 'bca cloud computing', category: 'UG', hit_count: 28 }, { query: 'mcom project guide', category: 'PG', hit_count: 19 }],
          rage_clicks: [{ element_selector: 'button#viewerClose', text_sample: 'Close', rage_count: 34 }, { element_selector: 'div.badge-pill', text_sample: 'FYUG 2024', rage_count: 19 }],
          devices: { mobile: 78, desktop: 22, network_4g: 74, network_3g: 21, network_broadband: 5 }
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      try {
        if (action === 'overview') {
          const sessionsCount = await env.DB.prepare('SELECT COUNT(*) as total FROM telemetry_sessions').first('total');
          const todayCount = await env.DB.prepare("SELECT COUNT(*) as today FROM telemetry_sessions WHERE start_time >= date('now', 'start of day')").first('today');
          const zeroCount = await env.DB.prepare('SELECT COUNT(*) as total FROM zero_search_ledger').first('total');
          const rageCount = await env.DB.prepare('SELECT SUM(rage_count) as total FROM rage_click_ledger').first('total');
          const avgDwell = await env.DB.prepare('SELECT AVG(dwell_seconds) as avg FROM reading_dwell_ledger').first('avg');

          return new Response(JSON.stringify({
            overview: {
              total_sessions: sessionsCount || 0,
              today_sessions: todayCount || 0,
              zero_searches_count: zeroCount || 0,
              rage_clicks_count: rageCount || 0,
              avg_dwell_seconds: Math.round(avgDwell || 0)
            }
          }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (action === 'geo') {
          const { results } = await env.DB.prepare(`
            SELECT region, city, COUNT(*) as count
            FROM telemetry_sessions
            GROUP BY region, city
            ORDER BY count DESC
            LIMIT 15
          `).all();
          return new Response(JSON.stringify({ geo: results }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (action === 'zero_searches') {
          const { results } = await env.DB.prepare(`
            SELECT query, category, hit_count, last_searched
            FROM zero_search_ledger
            ORDER BY hit_count DESC
            LIMIT 30
          `).all();
          return new Response(JSON.stringify({ zero_searches: results }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (action === 'frictions') {
          const { results } = await env.DB.prepare(`
            SELECT element_selector, text_sample, rage_count, last_rage
            FROM rage_click_ledger
            ORDER BY rage_count DESC
            LIMIT 25
          `).all();
          return new Response(JSON.stringify({ rage_clicks: results }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (action === 'devices') {
          const devices = await env.DB.prepare(`
            SELECT device_type, COUNT(*) as count
            FROM telemetry_sessions
            GROUP BY device_type
          `).all();
          const networks = await env.DB.prepare(`
            SELECT network_type, COUNT(*) as count
            FROM telemetry_sessions
            GROUP BY network_type
          `).all();
          return new Response(JSON.stringify({ devices: devices.results, networks: networks.results }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (action === 'recent_events') {
          const { results } = await env.DB.prepare(`
            SELECT id, session_id, event_type, page_url, selector, text_snippet, details_json, created_at
            FROM telemetry_events
            ORDER BY id DESC
            LIMIT 50
          `).all();
          return new Response(JSON.stringify({ recent_events: results }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    // ========================================================================
    // 4. PDF STREAMING & DOWNLOAD PROXY ROUTE
    // ========================================================================
    if (request.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin, 'Vary': 'Origin' }
      });
    }

    const raw = urlObj.searchParams.get('url');
    const customFilename = urlObj.searchParams.get('filename');

    if (!raw || typeof raw !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin, 'Vary': 'Origin' }
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
      headers.set('Access-Control-Allow-Origin', corsOrigin);
      headers.set('Vary', 'Origin');
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
