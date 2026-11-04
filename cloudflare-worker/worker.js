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

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

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
            // Filter non-actionable passive events from SQLite storage (GA4 already captures 100% of these)
            if (evt.t === 'section_in_view') continue;

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

          // Safety guard: cap batch size to 30 statements per request to prevent D1 row write exhaustion
          if (dbBatch.length > 30) dbBatch.length = 30;

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
      // Validate Authorization token strictly via Cloudflare Environment Variable
      const configuredSecret = (env && (env.ADMIN_SECRET || env.ADMIN_SECRET_TOKEN || '')).trim();
      if (!configuredSecret) {
        return new Response(JSON.stringify({ 
          error: 'Server authentication misconfigured: ADMIN_SECRET environment variable is not configured in Cloudflare Worker settings.' 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const authHeader = request.headers.get('Authorization') || '';
      const token = (authHeader.replace(/^Bearer\s+/i, '') || urlObj.searchParams.get('token') || '').trim();

      if (!token || !timingSafeEqual(token, configuredSecret)) {
        return new Response(JSON.stringify({ error: 'Unauthorized: Invalid or missing token' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const action = urlObj.searchParams.get('action') || 'overview';

      if (!env || !env.DB) {
        return new Response(JSON.stringify({
          status: 'awaiting_d1_binding',
          message: 'Cloudflare D1 binding [DB] not detected. Run `npx wrangler d1 create sgou-telemetry` to initialize.',
          overview: { total_sessions: 0, today_sessions: 0, zero_searches_count: 0, rage_clicks_count: 0, avg_dwell_seconds: 0 },
          geo: [],
          zero_searches: [],
          rage_clicks: [],
          devices: [],
          networks: [],
          recent_events: [],
          funnel: { landing: 0, searched: 0, inspected: 0, completed: 0, pct_searched: 0, pct_inspected: 0, pct_completed: 0 }
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      try {
        if (action === 'funnel') {
          const landing = await env.DB.prepare('SELECT COUNT(DISTINCT session_id) as total FROM telemetry_sessions').first('total') || 0;
          const searched = await env.DB.prepare("SELECT COUNT(DISTINCT session_id) as total FROM telemetry_events WHERE event_type IN ('search', 'search_focused', 'search_hesitation')").first('total') || 0;
          const inspected = await env.DB.prepare("SELECT COUNT(DISTINCT session_id) as total FROM telemetry_events WHERE event_type = 'click' AND (selector LIKE '%card%' OR selector LIKE '%item%' OR details_json LIKE '%card%')").first('total') || 0;
          const completed = await env.DB.prepare("SELECT COUNT(DISTINCT session_id) as total FROM telemetry_events WHERE event_type IN ('document_download', 'reader_page_dwell', 'consumption_choice')").first('total') || 0;

          return new Response(JSON.stringify({
            funnel: {
              landing,
              searched,
              inspected,
              completed,
              pct_searched: landing ? Math.round((searched / landing) * 100) : 0,
              pct_inspected: landing ? Math.round((inspected / landing) * 100) : 0,
              pct_completed: landing ? Math.round((completed / landing) * 100) : 0
            }
          }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
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

        if (action === 'realtime') {
          const active5m = await env.DB.prepare("SELECT COUNT(DISTINCT session_id) as total FROM telemetry_sessions WHERE last_active >= datetime('now', '-5 minutes')").first('total') || 0;
          const active30m = await env.DB.prepare("SELECT COUNT(DISTINCT session_id) as total FROM telemetry_sessions WHERE last_active >= datetime('now', '-30 minutes')").first('total') || 0;
          const topPages = (await env.DB.prepare("SELECT page_url, COUNT(*) as hits FROM telemetry_events WHERE created_at >= datetime('now', '-30 minutes') GROUP BY page_url ORDER BY hits DESC LIMIT 5").all()).results || [];
          return new Response(JSON.stringify({ realtime: { active_5m: active5m, active_30m: active30m, top_pages: topPages } }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (action === 'timeseries') {
          const daily = (await env.DB.prepare("SELECT date(start_time) as date_label, COUNT(DISTINCT session_id) as sessions FROM telemetry_sessions GROUP BY date_label ORDER BY date_label DESC LIMIT 14").all()).results || [];
          const hourlyToday = (await env.DB.prepare("SELECT strftime('%H:00', start_time) as hour_label, COUNT(DISTINCT session_id) as sessions FROM telemetry_sessions WHERE start_time >= date('now', 'start of day') GROUP BY hour_label ORDER BY hour_label ASC").all()).results || [];
          return new Response(JSON.stringify({ timeseries: { daily: daily.reverse(), hourly: hourlyToday } }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (action === 'heatmatrix') {
          const matrix = (await env.DB.prepare("SELECT cast(strftime('%w', start_time) as integer) as day_of_week, case when cast(strftime('%H', start_time) as integer) between 6 and 11 then 'Morning' when cast(strftime('%H', start_time) as integer) between 12 and 16 then 'Afternoon' when cast(strftime('%H', start_time) as integer) between 17 and 21 then 'Evening' else 'Night' end as time_block, COUNT(*) as session_count FROM telemetry_sessions GROUP BY day_of_week, time_block").all()).results || [];
          return new Response(JSON.stringify({ heatmatrix: matrix }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (action === 'comparison') {
          const period = urlObj.searchParams.get('period') || 'today';
          let curFilter = "start_time >= date('now', 'start of day')";
          let prevFilter = "start_time >= date('now', '-1 day', 'start of day') AND start_time < date('now', 'start of day')";
          let curEventFilter = "created_at >= date('now', 'start of day')";
          let prevEventFilter = "created_at >= date('now', '-1 day', 'start of day') AND created_at < date('now', 'start of day')";

          if (period === '7d') {
            curFilter = "start_time >= date('now', '-7 days')";
            prevFilter = "start_time >= date('now', '-14 days') AND start_time < date('now', '-7 days')";
            curEventFilter = "created_at >= date('now', '-7 days')";
            prevEventFilter = "created_at >= date('now', '-14 days') AND created_at < date('now', '-7 days')";
          }

          const curSessions = await env.DB.prepare(`SELECT COUNT(DISTINCT session_id) as total FROM telemetry_sessions WHERE ${curFilter}`).first('total') || 0;
          const prevSessions = await env.DB.prepare(`SELECT COUNT(DISTINCT session_id) as total FROM telemetry_sessions WHERE ${prevFilter}`).first('total') || 0;

          const curSearches = await env.DB.prepare(`SELECT COUNT(*) as total FROM telemetry_events WHERE event_type IN ('search', 'zero_search') AND ${curEventFilter}`).first('total') || 0;
          const prevSearches = await env.DB.prepare(`SELECT COUNT(*) as total FROM telemetry_events WHERE event_type IN ('search', 'zero_search') AND ${prevEventFilter}`).first('total') || 0;

          const curRages = await env.DB.prepare(`SELECT COUNT(*) as total FROM telemetry_events WHERE event_type = 'rage_click' AND ${curEventFilter}`).first('total') || 0;
          const prevRages = await env.DB.prepare(`SELECT COUNT(*) as total FROM telemetry_events WHERE event_type = 'rage_click' AND ${prevEventFilter}`).first('total') || 0;

          const curDownloads = await env.DB.prepare(`SELECT COUNT(*) as total FROM telemetry_events WHERE event_type = 'document_download' AND ${curEventFilter}`).first('total') || 0;
          const prevDownloads = await env.DB.prepare(`SELECT COUNT(*) as total FROM telemetry_events WHERE event_type = 'document_download' AND ${prevEventFilter}`).first('total') || 0;

          const calcDelta = (cur, prev) => {
            if (!prev) return cur > 0 ? 100 : 0;
            return Math.round(((cur - prev) / prev) * 100);
          };

          return new Response(JSON.stringify({
            period,
            metrics: {
              sessions: { current: curSessions, previous: prevSessions, delta_pct: calcDelta(curSessions, prevSessions) },
              searches: { current: curSearches, previous: prevSearches, delta_pct: calcDelta(curSearches, prevSearches) },
              rage_clicks: { current: curRages, previous: prevRages, delta_pct: calcDelta(curRages, prevRages) },
              downloads: { current: curDownloads, previous: prevDownloads, delta_pct: calcDelta(curDownloads, prevDownloads) }
            }
          }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (action === 'possibilities') {
          const possibilities = [];
          const topRage = await env.DB.prepare('SELECT element_selector, text_sample, rage_count FROM rage_click_ledger ORDER BY rage_count DESC LIMIT 5').all();
          (topRage.results || []).forEach(item => {
            if (item.rage_count >= 1) {
              possibilities.push({
                category: 'UI/UX Friction',
                severity: item.rage_count >= 10 ? 'HIGH' : 'MEDIUM',
                target: item.element_selector,
                evidence: `${item.rage_count} rage clicks logged on "${item.text_sample || item.element_selector}".`,
                recommendation: `Inspect click listener and visual feedback on ${item.element_selector}.`,
                potential_gain: 'Reduces student cognitive friction and eliminates click dead-ends.'
              });
            }
          });

          const topZeros = await env.DB.prepare('SELECT query, category, hit_count FROM zero_search_ledger ORDER BY hit_count DESC LIMIT 5').all();
          if ((topZeros.results || []).length > 0) {
            const queriesList = topZeros.results.map(z => `"${z.query}" (${z.hit_count} hits)`).join(', ');
            possibilities.push({
              category: 'Syllabus Demand & Search Gap',
              severity: topZeros.results[0].hit_count >= 5 ? 'HIGH' : 'MEDIUM',
              target: 'Course Index & Search Aliases',
              evidence: `Students repeatedly searched for missing content: ${queriesList}.`,
              recommendation: 'Map alternative search synonyms in js/config.js or prioritize scraping/ingesting new materials for these topics.',
              potential_gain: `Instantly resolves unmet search queries for student search sessions.`
            });
          }

          const lowEndCount = await env.DB.prepare("SELECT COUNT(*) as total FROM telemetry_sessions WHERE ram_gb <= 4 OR device_type = 'mobile'").first('total') || 0;
          const totalSessions = await env.DB.prepare('SELECT COUNT(*) as total FROM telemetry_sessions').first('total') || 1;
          const lowEndPct = Math.round((lowEndCount / totalSessions) * 100);

          if (lowEndPct >= 30) {
            possibilities.push({
              category: 'Mobile / Low-RAM Optimization',
              severity: 'MEDIUM',
              target: 'Canvas PDF Reader & Asset Delivery',
              evidence: `${lowEndPct}% of student sessions run on mobile devices or hardware with <= 4GB RAM.`,
              recommendation: 'Cap getOptimalRasterScale() at 1.0x on low-memory smartphones and enforce canvas buffer cleanup on page change.',
              potential_gain: 'Eliminates mobile browser tab crashes and reduces canvas memory overhead by ~45%.'
            });
          }

          return new Response(JSON.stringify({
            possibilities,
            total_analyzed: possibilities.length,
            generated_at: new Date().toISOString()
          }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (action === 'export') {
          const format = urlObj.searchParams.get('format') || 'json';
          const sessions = (await env.DB.prepare('SELECT * FROM telemetry_sessions ORDER BY start_time DESC LIMIT 1000').all()).results || [];
          const events = (await env.DB.prepare('SELECT id, session_id, event_type, page_url, selector, text_snippet, details_json, created_at FROM telemetry_events ORDER BY id DESC LIMIT 500').all()).results || [];
          const zeroSearches = (await env.DB.prepare('SELECT query, category, hit_count, last_searched FROM zero_search_ledger ORDER BY hit_count DESC').all()).results || [];
          const frictions = (await env.DB.prepare('SELECT element_selector, text_sample, rage_count, last_rage FROM rage_click_ledger ORDER BY rage_count DESC').all()).results || [];

          if (format === 'json') {
            return new Response(JSON.stringify({
              export_timestamp: new Date().toISOString(),
              platform: 'SGOU Academic Database Telemetry (Cloudflare D1)',
              sessions_count: sessions.length,
              events_count: events.length,
              zero_searches_count: zeroSearches.length,
              frictions_count: frictions.length,
              data: { sessions, events, zero_searches: zeroSearches, frictions }
            }, null, 2), {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json; charset=utf-8',
                'Content-Disposition': 'attachment; filename="sgou_telemetry_export_' + Date.now() + '.json"'
              }
            });
          }

          if (format === 'csv') {
            let csv = '--- ZERO SEARCH LEDGER ---\r\nQuery,Category,Hit Count,Last Searched\r\n';
            zeroSearches.forEach(z => {
              csv += `"${(z.query || '').replace(/"/g, '""')}","${z.category || ''}",${z.hit_count},"${z.last_searched}"\r\n`;
            });
            csv += '\r\n--- FRICTION RAGE CLICK LEDGER ---\r\nSelector,Text Snippet,Rage Count,Last Rage\r\n';
            frictions.forEach(f => {
              csv += `"${(f.element_selector || '').replace(/"/g, '""')}","${(f.text_sample || '').replace(/"/g, '""')}",${f.rage_count},"${f.last_rage}"\r\n`;
            });
            csv += '\r\n--- STUDENT SESSIONS ---\r\nSession ID,Country,Region,City,Device,Network,RAM GB,Cores,Start Time\r\n';
            sessions.forEach(s => {
              csv += `"${s.session_id}","${s.country || ''}","${s.region || ''}","${s.city || ''}","${s.device_type || ''}","${s.network_type || ''}",${s.ram_gb || 0},${s.cpu_cores || 0},"${s.start_time}"\r\n`;
            });

            return new Response(csv, {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': 'attachment; filename="sgou_telemetry_export_' + Date.now() + '.csv"'
              }
            });
          }

          if (format === 'ai_prompt') {
            let md = '# SGOU Academic Database — AI UX Optimization Brief\n\n';
            md += '**Export Date:** ' + new Date().toISOString() + '\n';
            md += '**Total Analyzed Sessions:** ' + sessions.length + '\n\n';
            md += '## 1. System Overview\n';
            md += '- **Total Zero-Result Searches:** ' + zeroSearches.length + '\n';
            md += '- **Primary Friction Points:** ' + frictions.length + '\n\n';

            md += '## 2. Top Unmet Student Search Queries (Syllabus Gaps)\n';
            zeroSearches.slice(0, 10).forEach((z, i) => {
              md += (i + 1) + '. `' + z.query + '` [' + z.category + '] — ' + z.hit_count + ' failed attempts (Last: ' + z.last_searched + ')\n';
            });

            md += '\n## 3. UI Friction Hotspots (Rage Clicks)\n';
            frictions.slice(0, 10).forEach((f, i) => {
              md += (i + 1) + '. Selector: `' + f.element_selector + '` ("' + (f.text_sample || '') + '") — ' + f.rage_count + ' rage clicks\n';
            });

            md += '\n## 4. Hardware & Network Environmental Profile\n';
            const mobileCount = sessions.filter(s => s.device_type === 'mobile').length;
            const lowRamCount = sessions.filter(s => (s.ram_gb || 0) <= 4).length;
            md += '- **Mobile Users:** ' + Math.round((mobileCount / (sessions.length || 1)) * 100) + '% (' + mobileCount + ' sessions)\n';
            md += '- **Low RAM Devices (<=4GB):** ' + Math.round((lowRamCount / (sessions.length || 1)) * 100) + '% (' + lowRamCount + ' sessions)\n\n';

            md += '## 5. AI Prompt Directive\n';
            md += '> "Act as a Lead UI/UX Engineer and Educational Platform Architect. Review the telemetry data above from the SGOU Academic Database. Propose a concrete, prioritized redesign plan that solves the top rage click friction points, improves discovery for the unmet search queries, and optimizes the canvas reader for the detected mobile hardware profile. Provide exact CSS, HTML layout patterns, and JavaScript event optimizations."\n';

            return new Response(md, {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'text/markdown; charset=utf-8',
                'Content-Disposition': 'attachment; filename="sgou_telemetry_ai_brief_' + Date.now() + '.md"'
              }
            });
          }

          return new Response(JSON.stringify({ error: 'Unsupported format' }), { status: 400, headers: corsHeaders });
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
