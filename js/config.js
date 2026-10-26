// ============================================================================
// SGOU Academic Database — Global Client Configuration
// ============================================================================

window.SGOU_CONFIG = {
  // Cloudflare Worker Proxy URL for PDF downloads and mobile canvas streaming.
  // When set (e.g. 'https://sgou-pdf-proxy.<subdomain>.workers.dev'), downloads and
  // viewer streams route through Cloudflare's free, zero-egress edge network.
  //
  // Leave empty ('') for direct CloudFront downloads (zero cost, zero proxy).
  PDF_PROXY_URL: 'https://sgou-pdf-proxy.researcher-tizar.workers.dev'
};
