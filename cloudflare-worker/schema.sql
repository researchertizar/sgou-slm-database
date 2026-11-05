-- ============================================================================
-- SGOU Academic Database — Cloudflare D1 Telemetry Schema
-- 100% Free Edge SQLite Database for Deep UX & Environmental Profiling
-- ============================================================================

-- 1. Master Sessions Table (Enriched with Cloudflare Edge Geolocation)
CREATE TABLE IF NOT EXISTS telemetry_sessions (
    session_id TEXT PRIMARY KEY,
    user_id TEXT,
    is_returning INTEGER DEFAULT 0,
    visit_count INTEGER DEFAULT 1,
    is_active INTEGER DEFAULT 0,
    country TEXT,
    region TEXT,
    city TEXT,
    postal_code TEXT,
    latitude REAL,
    longitude REAL,
    isp TEXT,
    colo TEXT,
    device_type TEXT,
    screen_res TEXT,
    viewport TEXT,
    dpr REAL,
    ram_gb REAL,
    cpu_cores INTEGER,
    touch INTEGER DEFAULT 0,
    is_pwa INTEGER DEFAULT 0,
    network_type TEXT,
    downlink_mbps REAL,
    rtt_ms INTEGER,
    save_data INTEGER DEFAULT 0,
    theme TEXT,
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sess_user ON telemetry_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sess_active ON telemetry_sessions(last_active);
CREATE INDEX IF NOT EXISTS idx_sess_region ON telemetry_sessions(region);
CREATE INDEX IF NOT EXISTS idx_sess_city ON telemetry_sessions(city);
CREATE INDEX IF NOT EXISTS idx_sess_time ON telemetry_sessions(start_time);

-- 1b. Persistent User Identification Ledger
CREATE TABLE IF NOT EXISTS telemetry_users (
    user_id TEXT PRIMARY KEY,
    first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_sessions INTEGER DEFAULT 1,
    total_downloads INTEGER DEFAULT 0,
    total_reads INTEGER DEFAULT 0,
    country TEXT,
    region TEXT,
    city TEXT,
    device_type TEXT,
    preferred_programme TEXT
);
CREATE INDEX IF NOT EXISTS idx_usr_last_seen ON telemetry_users(last_seen);

-- 2. Chronological Interaction Event Stream
CREATE TABLE IF NOT EXISTS telemetry_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    page_url TEXT,
    time_offset_ms INTEGER,
    selector TEXT,
    text_snippet TEXT,
    details_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_evt_type ON telemetry_events(event_type);
CREATE INDEX IF NOT EXISTS idx_evt_session ON telemetry_events(session_id);
CREATE INDEX IF NOT EXISTS idx_evt_created ON telemetry_events(created_at);

-- 3. Zero-Search Demand Ledger
CREATE TABLE IF NOT EXISTS zero_search_ledger (
    query TEXT PRIMARY KEY,
    category TEXT,
    hit_count INTEGER DEFAULT 1,
    last_searched TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_zero_hits ON zero_search_ledger(hit_count DESC);

-- 4. UX Friction & Rage-Click Ledger
CREATE TABLE IF NOT EXISTS rage_click_ledger (
    element_selector TEXT PRIMARY KEY,
    text_sample TEXT,
    rage_count INTEGER DEFAULT 1,
    last_rage TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_rage_count ON rage_click_ledger(rage_count DESC);

-- 5. Document Reading Velocity & Dwell Ledger
CREATE TABLE IF NOT EXISTS reading_dwell_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    course_code TEXT NOT NULL,
    page_number INTEGER DEFAULT 1,
    dwell_seconds REAL NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_reading_course ON reading_dwell_ledger(course_code);
