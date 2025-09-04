-- Mesh Network Tables for BitChat Integration

-- Mesh Peers table: Stores information about discovered and known mesh peers
CREATE TABLE IF NOT EXISTS mesh_peers (
    id TEXT PRIMARY KEY,
    noise_public_key TEXT UNIQUE NOT NULL,
    signing_public_key TEXT NOT NULL,
    nickname TEXT NOT NULL,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_connected BOOLEAN DEFAULT 0,
    is_reachable BOOLEAN DEFAULT 0,
    is_favorite BOOLEAN DEFAULT 0,
    is_blocked BOOLEAN DEFAULT 0,
    is_verified BOOLEAN DEFAULT 0,
    metadata TEXT
);

-- Mesh Messages table: Stores messages received/sent over the mesh network
CREATE TABLE IF NOT EXISTS mesh_messages (
    id TEXT PRIMARY KEY,
    sender_id TEXT NOT NULL,
    recipient_id TEXT,
    content TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_private BOOLEAN DEFAULT 0,
    is_encrypted BOOLEAN DEFAULT 0,
    delivery_status TEXT DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
    metadata TEXT,
    FOREIGN KEY (sender_id) REFERENCES mesh_peers(id) ON DELETE CASCADE
);

-- Estadias (Stays/Room Access) System Tables

-- Estadias table: Manages guest stays and room assignments
CREATE TABLE IF NOT EXISTS estadias (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    festival_id TEXT NOT NULL,
    room_id TEXT NOT NULL,
    access_code TEXT UNIQUE NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'checked_in', 'checked_out', 'cancelled', 'expired')),
    check_in_time DATETIME,
    check_out_time DATETIME,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (festival_id) REFERENCES festivals(id) ON DELETE CASCADE
);

-- Room Access Logs: Records attempts and successful room accesses
CREATE TABLE IF NOT EXISTS room_access_logs (
    id TEXT PRIMARY KEY,
    estadia_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    room_id TEXT NOT NULL,
    access_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    access_granted BOOLEAN NOT NULL,
    reason TEXT,
    FOREIGN KEY (estadia_id) REFERENCES estadias(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Offline Queue: Stores data for synchronization when internet connection is restored
CREATE TABLE IF NOT EXISTS offline_queue (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    data TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_processed BOOLEAN DEFAULT 0,
    processed_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_mesh_peers_noise_public_key ON mesh_peers(noise_public_key);
CREATE INDEX IF NOT EXISTS idx_mesh_messages_sender_id ON mesh_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_mesh_messages_recipient_id ON mesh_messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_mesh_messages_timestamp ON mesh_messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_estadias_user_id ON estadias(user_id);
CREATE INDEX IF NOT EXISTS idx_estadias_festival_id ON estadias(festival_id);
CREATE INDEX IF NOT EXISTS idx_estadias_room_id ON estadias(room_id);
CREATE INDEX IF NOT EXISTS idx_room_access_logs_estadia_id ON room_access_logs(estadia_id);
CREATE INDEX IF NOT EXISTS idx_room_access_logs_user_id ON room_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_offline_queue_user_id ON offline_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_offline_queue_processed ON offline_queue(is_processed);