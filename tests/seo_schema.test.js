const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');

// Helper to extract meta tag content
function getMetaContent(html, nameOrProp) {
    const regex = new RegExp(`<meta\\s+[^>]*?(?:name|property)=["']${nameOrProp}["'][^>]*?content=["']([^"']*)["']`, 'i');
    const match = html.match(regex);
    if (match) return match[1];
    const altRegex = new RegExp(`<meta\\s+[^>]*?content=["']([^"']*)["'][^>]*?(?:name|property)=["']${nameOrProp}["']`, 'i');
    const altMatch = html.match(altRegex);
    return altMatch ? altMatch[1] : null;
}

// Helper to extract and parse JSON-LD
function getJsonLd(html) {
    const regex = /<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi;
    const results = [];
    let match;
    while ((match = regex.exec(html)) !== null) {
        try {
            results.push(JSON.parse(match[1]));
        } catch (err) {
            assert.fail('Failed to parse JSON-LD script block: ' + err.message);
        }
    }
    return results;
}

test('SEO SERP Audit: Meta description character lengths under 160 chars', () => {
    const indexHtml = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf-8');
    const viewHtml = fs.readFileSync(path.join(ROOT_DIR, 'view.html'), 'utf-8');
    const readerHtml = fs.readFileSync(path.join(ROOT_DIR, 'reader.html'), 'utf-8');

    const indexDesc = getMetaContent(indexHtml, 'description');
    assert.ok(indexDesc, 'index.html must have meta description');
    assert.ok(indexDesc.length <= 160, `index.html meta description too long (${indexDesc.length} chars, must be <= 160)`);
    assert.ok(indexDesc.length >= 50, `index.html meta description too short (${indexDesc.length} chars)`);

    const viewDesc = getMetaContent(viewHtml, 'description');
    assert.ok(viewDesc, 'view.html must have meta description');
    assert.ok(viewDesc.length <= 160, `view.html meta description too long (${viewDesc.length} chars, must be <= 160)`);

    const readerDesc = getMetaContent(readerHtml, 'description');
    assert.ok(readerDesc, 'reader.html must have meta description');
    assert.ok(readerDesc.length <= 160, `reader.html meta description too long (${readerDesc.length} chars, must be <= 160)`);
});

test('SEO Entity Graph: Schema.org Organization node presence with legalName, logo, and sameAs', () => {
    const indexHtml = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf-8');
    const jsonLdBlocks = getJsonLd(indexHtml);
    assert.ok(jsonLdBlocks.length > 0, 'index.html must contain JSON-LD');

    const graph = jsonLdBlocks[0]['@graph'] || jsonLdBlocks;
    const orgNode = graph.find(node => {
        if (Array.isArray(node['@type'])) {
            return node['@type'].includes('Organization');
        }
        return node['@type'] === 'Organization';
    });

    assert.ok(orgNode, 'index.html JSON-LD graph must contain an Organization node');
    assert.strictEqual(orgNode.name, 'SGOU Academic Database');
    assert.strictEqual(orgNode.legalName, 'SGOU Academic Database');
    assert.ok(orgNode.url, 'Organization must have a url');
    assert.ok(orgNode.logo, 'Organization must have a logo');
    assert.ok(Array.isArray(orgNode.sameAs) && orgNode.sameAs.length > 0, 'Organization must have sameAs array');

    // Check WebSite publisher reference
    const websiteNode = graph.find(node => node['@type'] === 'WebSite');
    assert.ok(websiteNode, 'WebSite node must exist');
    assert.strictEqual(websiteNode.publisher['@id'], 'https://sgou-slm-database.vercel.app/#organization');
});

test('SEO Entity Graph: view.html and reader.html contain Organization schema', () => {
    const viewHtml = fs.readFileSync(path.join(ROOT_DIR, 'view.html'), 'utf-8');
    const viewBlocks = getJsonLd(viewHtml);
    const viewGraph = viewBlocks[0]['@graph'] || viewBlocks;
    const viewOrg = viewGraph.find(node => node['@type'] === 'Organization');
    assert.ok(viewOrg, 'view.html JSON-LD must contain Organization node');
    assert.ok(Array.isArray(viewOrg.sameAs) && viewOrg.sameAs.length > 0, 'view.html Organization must have sameAs array');

    const readerHtml = fs.readFileSync(path.join(ROOT_DIR, 'reader.html'), 'utf-8');
    const readerBlocks = getJsonLd(readerHtml);
    const readerGraph = readerBlocks[0]['@graph'] || readerBlocks;
    const readerOrg = readerGraph.find(node => node['@type'] === 'Organization');
    assert.ok(readerOrg, 'reader.html JSON-LD must contain Organization node');
    assert.ok(Array.isArray(readerOrg.sameAs) && readerOrg.sameAs.length > 0, 'reader.html Organization must have sameAs array');
});

test('Zero-Emoji Compliance: SEO schema and metadata files contains zero emojis', () => {
    const files = [
        path.join(ROOT_DIR, 'index.html'),
        path.join(ROOT_DIR, 'view.html'),
        path.join(ROOT_DIR, 'reader.html'),
        path.join(ROOT_DIR, 'sw.js'),
        path.join(ROOT_DIR, 'admin', 'dashboard.html'),
        __filename
    ];
    // Regex matching emoji characters
    const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;

    for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');
        // Check head section for HTML, or full content for JS
        const headMatch = content.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
        const textToCheck = headMatch ? headMatch[1] : content;
        assert.ok(!emojiRegex.test(textToCheck), `${path.basename(file)} must not contain any emoji`);
    }
});

test('Platform Upgrade & Intelligence Cockpit: v165 ServiceWorker and Advanced Analytics Integration', () => {
    const swContent = fs.readFileSync(path.join(ROOT_DIR, 'sw.js'), 'utf-8');
    assert.ok(swContent.includes("CACHE = 'sgou-v165'"), 'ServiceWorker must be upgraded to cache version sgou-v165');

    const dashPath = path.join(ROOT_DIR, 'admin', 'dashboard.html');
    const dashContent = fs.readFileSync(dashPath, 'utf-8');
    assert.ok(dashContent.includes('hourlyStudyHeatmapContainer'), 'Dashboard must have 24-hour study intensity curve container');
    assert.ok(dashContent.includes('degreeMarketShareContainer'), 'Dashboard must have degree market share breakdown container');
    assert.ok(dashContent.includes('healthEdgeLatency'), 'Dashboard must have Edge latency indicator');
    assert.ok(dashContent.includes('btnPeriod24h'), 'Dashboard must support 24h comparative period');
    assert.ok(dashContent.includes('btnPeriod30d'), 'Dashboard must support 30d comparative period');
});
