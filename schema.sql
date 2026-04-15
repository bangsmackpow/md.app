-- User Profiles
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, 
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    is_activated INTEGER DEFAULT 0,
    is_admin INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active', -- active, suspended, deactivated
    force_password_change INTEGER DEFAULT 0,
    two_factor_enabled INTEGER DEFAULT 0,
    two_factor_secret TEXT,
    storage_quota_mb INTEGER DEFAULT 500,
    current_usage_bytes INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    last_login INTEGER
);

-- Administrative Audit Logs
CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id TEXT PRIMARY KEY,
    admin_id TEXT NOT NULL,
    target_user_id TEXT,
    action TEXT NOT NULL, -- e.g., 'UPDATE_QUOTA', 'SUSPEND_USER'
    details TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (admin_id) REFERENCES users(id)
);

-- Document Level Sharing (Form A)
CREATE TABLE IF NOT EXISTS shared_notes (
    id TEXT PRIMARY KEY,
    sender_id TEXT NOT NULL,
    recipient_email TEXT NOT NULL,
    note_title TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, accepted, declined
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (sender_id) REFERENCES users(id)
    );

    -- Live Collaboration (Form B)
    CREATE TABLE IF NOT EXISTS live_shares (
    id TEXT PRIMARY KEY,
    host_id TEXT NOT NULL,
    note_path TEXT NOT NULL,
    content TEXT,
    last_updated INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (host_id) REFERENCES users(id)
    );

    -- Vault Members
CREATE TABLE IF NOT EXISTS vaults (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    encryption_enabled INTEGER DEFAULT 0,
    encryption_salt TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (owner_id) REFERENCES users(id)
);

-- Vault Membership (for Sharing)
CREATE TABLE IF NOT EXISTS vault_members (
    vault_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT CHECK( role IN ('owner', 'editor', 'viewer') ) NOT NULL DEFAULT 'viewer',
    PRIMARY KEY (vault_id, user_id),
    FOREIGN KEY (vault_id) REFERENCES vaults(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Note Revisions (Audit & History)
CREATE TABLE IF NOT EXISTS note_revisions (
    id TEXT PRIMARY KEY,
    vault_id TEXT NOT NULL,
    note_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    hash TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (vault_id) REFERENCES vaults(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
