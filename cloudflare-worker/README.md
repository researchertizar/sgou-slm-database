# SGOU PDF Download, Streaming Proxy & Serverless Telemetry Gateway

This Cloudflare Worker handles PDF streaming, UX telemetry collection, and serverless analytics queries with **100% free hosting and unlimited bandwidth/egress**.

---

## Capabilities

1. **Zero-Cost PDF Streaming**: Streams heavy PDF coursebooks directly with HTTP Range request support and edge caching, shielding Vercel from bandwidth costs.
2. **High-Precision UX Telemetry**: Ingests student interaction sessions, reading dwell times, rage clicks, and zero-result searches via `/api/telemetry` into Cloudflare D1.
3. **Analytics Dashboard API**: Powers [`/admin/dashboard.html`](../admin/dashboard.html) via `/api/analytics/query` with timing-safe authenticated token validation.
4. **Resilient Fallback Mode**: If D1 is not yet provisioned, the worker operates normally for all PDF downloads and returns structured diagnostics to the dashboard without crashing.

---

## 2-Minute Deployment Guide

### Option A: Via Wrangler CLI (Recommended)

1. **Install Wrangler & Authenticate**:
   ```bash
   npx wrangler login
   ```

2. **Initialize Serverless D1 Database**:
   ```bash
   npx wrangler d1 create sgou-telemetry
   ```
   *Copy the output `database_id` into [`wrangler.toml`](wrangler.toml).*

3. **Execute SQL Schema**:
   ```bash
   npx wrangler d1 execute sgou-telemetry --file=./schema.sql --remote
   ```

4. **Deploy the Worker**:
   ```bash
   npx wrangler deploy
   ```

5. **Connect to Frontend**:
   Open [`js/config.js`](../js/config.js) in the repository root and set:
   ```javascript
   window.SGOU_CONFIG = {
     PDF_PROXY_URL: 'https://sgou-pdf-proxy.<your-subdomain>.workers.dev'
   };
   ```

---

### Option B: Via Cloudflare Web Dashboard

1. **Log in to Cloudflare**: Go to [dash.cloudflare.com](https://dash.cloudflare.com/).
2. **Create Worker**: Navigate to **Compute (Workers & Pages)** $\rightarrow$ **Create Worker** (`sgou-pdf-proxy`).
3. **Paste Code**: Click **Edit code**, paste [`worker.js`](worker.js), then click **Save and Deploy**.
4. **Create D1 Database (Optional)**:
   - Navigate to **Storage & Databases** $\rightarrow$ **D1 SQL Database** $\rightarrow$ **Create Database** (`sgou-telemetry`).
   - Run the SQL statements from [`schema.sql`](schema.sql) in the D1 console.
   - Go to your Worker $\rightarrow$ **Settings** $\rightarrow$ **Bindings** $\rightarrow$ Add D1 database binding with variable name `DB`.

---

## Free Tier Quotas & Burden Handling

| Service | Free Tier Limit | SGOU Usage | Headroom |
| :--- | :--- | :--- | :--- |
| **Worker Requests** | 100,000 requests / day | ~2,500 requests / day | **40x headroom** |
| **Worker Bandwidth** | **Unlimited / \$0.00** | All PDF traffic | **Infinite** |
| **D1 Row Reads** | 5,000,000 rows / day | ~50,000 reads / day | **100x headroom** |
| **D1 Row Writes** | 100,000 rows / day | ~4,000 writes / day (batched) | **25x headroom** |
| **D1 Storage** | 10 GB | ~15 MB / year | **650+ years** |
