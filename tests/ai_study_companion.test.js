const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

test('AI Study Companion: D1 Database Schema Integrity', () => {
  const schemaSql = fs.readFileSync(path.join(__dirname, '..', 'cloudflare-worker', 'schema.sql'), 'utf8');

  // Verify ai_cache table & fields
  assert(schemaSql.includes('CREATE TABLE IF NOT EXISTS ai_cache'), 'Schema must define ai_cache table');
  assert(schemaSql.includes('cache_key TEXT PRIMARY KEY'), 'ai_cache must use cache_key as primary key');
  assert(schemaSql.includes('content_markdown TEXT NOT NULL'), 'ai_cache must store content_markdown');
  assert(schemaSql.includes('cached_at INTEGER NOT NULL'), 'ai_cache must store cached_at epoch timestamp');
  assert(schemaSql.includes('idx_ai_cache_lookup'), 'Schema must index ai_cache lookup');

  // Verify support_claims table & fields
  assert(schemaSql.includes('CREATE TABLE IF NOT EXISTS support_claims'), 'Schema must define support_claims table');
  assert(schemaSql.includes('utr_number TEXT PRIMARY KEY'), 'support_claims must enforce UNIQUE utr_number as primary key');
  assert(schemaSql.includes('passkey TEXT UNIQUE NOT NULL'), 'support_claims must store UNIQUE passkey');
  assert(schemaSql.includes('plan_type TEXT NOT NULL'), 'support_claims must record plan_type');
  assert(schemaSql.includes('expires_at TIMESTAMP NOT NULL'), 'support_claims must record expires_at');
});

test('AI Study Companion: Cloudflare Worker Endpoint & Logic Integrity', () => {
  const workerJs = fs.readFileSync(path.join(__dirname, '..', 'cloudflare-worker', 'worker.js'), 'utf8');

  // Verify endpoints
  assert(workerJs.includes("pathname === '/api/support/verify-screenshot'"), 'Worker must handle /api/support/verify-screenshot');
  assert(workerJs.includes("pathname === '/api/support/restore-passkey'"), 'Worker must handle /api/support/restore-passkey');
  assert(workerJs.includes("pathname === '/api/ai-tutor' && request.method === 'GET'"), 'Worker must handle GET /api/ai-tutor');
  assert(workerJs.includes("pathname === '/api/ai-tutor/generate' && request.method === 'POST'"), 'Worker must handle POST /api/ai-tutor/generate');

  // Verify plan derivation
  assert(workerJs.includes('deriveStudyPassPlan'), 'Worker must implement deriveStudyPassPlan');
  assert(workerJs.includes('pass_24h') && workerJs.includes('pass_3d') && workerJs.includes('pass_14d') && workerJs.includes('pass_30d'),
    'Plan matrix must support 24h, 3d, 14d, and 30d Study Passes');

  // Verify Gemini Flash Vision & Tutor integration
  assert(workerJs.includes('callGeminiVisionReceipt'), 'Worker must implement callGeminiVisionReceipt');
  assert(workerJs.includes('callGeminiStudyTutor'), 'Worker must implement callGeminiStudyTutor');
  assert(workerJs.includes('gemini-3.8-flash') || workerJs.includes('gemini-flash-latest'), 'Worker must target active Gemini Flash models');
});

test('AI Study Companion: reader.html UI & Bottom Sheet Integration', () => {
  const readerHtml = fs.readFileSync(path.join(__dirname, '..', 'reader.html'), 'utf8');

  // Verify floating bottom bar dock button
  assert(readerHtml.includes('id="aiCompanionBtn"'), 'reader.html bottom bar must include #aiCompanionBtn');
  assert(readerHtml.includes('ai-bar-btn'), 'Button must have ai-bar-btn class');

  // Verify selection action pill AI trigger
  assert(readerHtml.includes('id="aiExplainSelectionBtn"'), 'Selection pill must include #aiExplainSelectionBtn');

  // Verify slide-up bottom sheet
  assert(readerHtml.includes('id="aiCompanionSheet"'), 'reader.html must include #aiCompanionSheet');
  assert(readerHtml.includes('id="aiSheetBlankState"'), 'Sheet must include #aiSheetBlankState for minimal initial view');
  assert(readerHtml.includes('id="aiSheetContent"'), 'Sheet must include #aiSheetContent');
  assert(readerHtml.includes('id="aiSheetQuotaCard"'), 'Sheet must include #aiSheetQuotaCard for freemium limits');
  assert(readerHtml.includes('id="aiReceiptUploadInput"'), 'Sheet must include hidden file input for screenshot upload');

  // Verify 4 minimal option pills
  assert(readerHtml.includes('data-mode="malayalam"'), 'Must include Explain in Malayalam pill');
  assert(readerHtml.includes('data-mode="english"'), 'Must include Simple English pill');
  assert(readerHtml.includes('data-mode="questions"'), 'Must include Exam Questions pill');
  assert(readerHtml.includes('data-mode="revision"'), 'Must include Revision / Recap pill');

  // Verify asset links
  assert(readerHtml.includes('css/components/ai-companion.css'), 'reader.html must link ai-companion.css');
  assert(readerHtml.includes('js/components/ai-companion.js'), 'reader.html must link ai-companion.js');
});

test('AI Study Companion: Client Component & 15-Day Zero-Token Caching Engine', () => {
  const compJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'components', 'ai-companion.js'), 'utf8');

  assert(compJs.includes('window.AiCompanion = AiCompanion'), 'Must expose window.AiCompanion');
  assert(compJs.includes('ttlMs: 15 * 86400 * 1000'), 'Must enforce 15-day TTL caching');
  assert(compJs.includes('dailyFreeLimit: 5'), 'Must enforce 5 free queries per day');
  assert(compJs.includes('verifyScreenshot'), 'Must implement verifyScreenshot with canvas compression');
  assert(compJs.includes('toDataURL'), 'Must use canvas toDataURL for lightweight image compression');
  assert(compJs.includes('SupportModal.open'), 'Must connect to SupportModal when quota is reached');
});
