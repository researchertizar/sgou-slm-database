# SGOU PDF Download & Streaming Proxy (Cloudflare Worker)

This Cloudflare Worker replaces the Vercel Edge compute function with **100% free hosting and unlimited bandwidth/egress**.

---

## 2-Minute Deployment Guide (Via Cloudflare Dashboard)

1. **Log in to Cloudflare**:
   - Go to [dash.cloudflare.com](https://dash.cloudflare.com/) (create a free account if you don't have one).
2. **Create a Worker**:
   - In the left sidebar, navigate to **Compute (Workers & Pages)** $\rightarrow$ **Workers & Pages**.
   - Click **Create Application** $\rightarrow$ **Create Worker**.
   - Give it a name (e.g., `sgou-pdf-proxy`), then click **Deploy**.
3. **Paste the Code**:
   - On the worker page, click **Edit code**.
   - Replace everything in `worker.js` with the contents of [`worker.js`](worker.js).
   - Click **Save and Deploy**.
4. **Copy your Worker URL**:
   - Your worker will have a URL like `https://sgou-pdf-proxy.<your-subdomain>.workers.dev`.
5. **Connect to SGOU Database**:
   - Open [`js/config.js`](../js/config.js) in this repo and set:
     ```javascript
     window.SGOU_CONFIG = {
       PDF_PROXY_URL: 'https://sgou-pdf-proxy.<your-subdomain>.workers.dev'
     };
     ```
   - Commit and push. You are done!

---

## Why this saves your Vercel account:
- **Cloudflare Workers Free Tier**:
  - 100,000 requests per day (SGOU database averages ~70 requests/day).
  - **Zero egress fees / Unlimited bandwidth**.
  - Edge caching at Cloudflare global CDN.
- **Vercel Fast Origin Transfer**:
  - Drops from 30+ GB down to **0 GB permanently**!
