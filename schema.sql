-- User Profiles
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, 
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    is_activated INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    last_login INTEGER
);

-- Vaults
CREATE TABLE IF NOT EXISTS vaults (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    r2_endpoint TEXT,
    r2_access_key TEXT,
    r2_secret_key TEXT,
    r2_bucket TEXT,
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
