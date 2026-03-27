-- User Profiles
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, -- UUID or OAuth Subject
    email TEXT UNIQUE NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    last_login INTEGER
);

-- Vaults (A collection of notes, mapping to a specific R2 prefix or bucket)
CREATE TABLE IF NOT EXISTS vaults (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    r2_bucket TEXT NOT NULL,
    r2_prefix TEXT, -- Optional: allowing multiple vaults in one bucket
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (owner_id) REFERENCES users(id)
);

-- Permissions (Who can see what vault)
CREATE TABLE IF NOT EXISTS vault_members (
    vault_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT CHECK( role IN ('owner', 'editor', 'viewer') ) NOT NULL DEFAULT 'viewer',
    PRIMARY KEY (vault_id, user_id),
    FOREIGN KEY (vault_id) REFERENCES vaults(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Sessions (Simplified Magic Link / Auth Token storage)
CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
