-- BitChat Mesh Network Support Schema
-- Extends the existing Tiikii Festival database to support offline Bluetooth mesh communication

-- Mesh peer identities table
-- Stores cryptographic identities for mesh network participants
CREATE TABLE IF NOT EXISTS mesh_identities (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    festival_id TEXT NOT NULL,
    fingerprint TEXT UNIQUE NOT NULL, -- SHA256 of Noise static public key
    static_public_key TEXT NOT NULL, -- Base64 encoded Curve25519 public key
    signing_public_key TEXT, -- Base64 encoded Ed25519 public key (optional)
    nickname TEXT NOT NULL,
    first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1,
    trust_level TEXT DEFAULT 'unknown' CHECK (trust_level IN ('unknown', 'casual', 'trusted', 'verified')),
    is_favorite BOOLEAN DEFAULT 0,
    is_blocked BOOLEAN DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (festival_id) REFERENCES festivals(id) ON DELETE CASCADE
);

-- Mesh sessions table
-- Tracks active Noise protocol sessions between peers
CREATE TABLE IF NOT EXISTS mesh_sessions (
    id TEXT PRIMARY KEY,
    local_identity_id TEXT NOT NULL,
    remote_identity_id TEXT NOT NULL,
    session_key TEXT NOT NULL, -- Encrypted session state
    handshake_state TEXT DEFAULT 'none' CHECK (handshake_state IN ('none', 'initiated', 'in_progress', 'completed', 'failed')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    is_active BOOLEAN DEFAULT 1,
    FOREIGN KEY (local_identity_id) REFERENCES mesh_identities(id) ON DELETE CASCADE,
    FOREIGN KEY (remote_identity_id) REFERENCES mesh_identities(id) ON DELETE CASCADE
);

-- Mesh messages table
-- Stores messages sent through the mesh network
CREATE TABLE IF NOT EXISTS mesh_messages (
    id TEXT PRIMARY KEY,
    sender_identity_id TEXT NOT NULL,
    recipient_identity_id TEXT, -- NULL for broadcast messages
    room_id TEXT, -- NULL for direct messages
    message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'location', 'ticket', 'estadia', 'system')),
    content TEXT NOT NULL,
    encrypted_content TEXT, -- For private messages
    is_private BOOLEAN DEFAULT 0,
    is_relay BOOLEAN DEFAULT 0,
    original_sender_id TEXT, -- For relayed messages
    ttl INTEGER DEFAULT 7, -- Time-to-live for mesh routing
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    delivered_at DATETIME,
    read_at DATETIME,
    is_delivered BOOLEAN DEFAULT 0,
    is_read BOOLEAN DEFAULT 0,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    FOREIGN KEY (sender_identity_id) REFERENCES mesh_identities(id) ON DELETE CASCADE,
    FOREIGN KEY (recipient_identity_id) REFERENCES mesh_identities(id) ON DELETE SET NULL,
    FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (original_sender_id) REFERENCES mesh_identities(id) ON DELETE SET NULL
);

-- Mesh rooms table
-- Bluetooth mesh chat rooms (separate from internet-based chat rooms)
CREATE TABLE IF NOT EXISTS mesh_rooms (
    id TEXT PRIMARY KEY,
    festival_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT DEFAULT 'general' CHECK (type IN ('general', 'stage', 'area', 'emergency', 'staff', 'vip')),
    geohash TEXT, -- Location-based room using geohash
    latitude REAL,
    longitude REAL,
    radius REAL, -- Radius in meters for location-based rooms
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (festival_id) REFERENCES festivals(id) ON DELETE CASCADE
);

-- Mesh room participants table
CREATE TABLE IF NOT EXISTS mesh_room_participants (
    room_id TEXT NOT NULL,
    identity_id TEXT NOT NULL,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_read_at DATETIME,
    is_admin BOOLEAN DEFAULT 0,
    PRIMARY KEY (room_id, identity_id),
    FOREIGN KEY (room_id) REFERENCES mesh_rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (identity_id) REFERENCES mesh_identities(id) ON DELETE CASCADE
);

-- Estadias (stays/room access) system
CREATE TABLE IF NOT EXISTS estadias (
    id TEXT PRIMARY KEY,
    festival_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL CHECK (type IN ('hotel', 'camping', 'vip_lounge', 'backstage', 'green_room', 'meeting_room')),
    location TEXT,
    latitude REAL,
    longitude REAL,
    capacity INTEGER,
    current_occupancy INTEGER DEFAULT 0,
    access_level TEXT DEFAULT 'general' CHECK (access_level IN ('general', 'vip', 'staff', 'artist', 'crew')),
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (festival_id) REFERENCES festivals(id) ON DELETE CASCADE
);

-- Estadia access permissions
CREATE TABLE IF NOT EXISTS estadia_access (
    id TEXT PRIMARY KEY,
    estadia_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    ticket_id TEXT, -- Optional: link to ticket for access
    access_type TEXT DEFAULT 'temporary' CHECK (access_type IN ('permanent', 'temporary', 'scheduled')),
    granted_by TEXT, -- User ID who granted access
    granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    is_active BOOLEAN DEFAULT 1,
    notes TEXT,
    FOREIGN KEY (estadia_id) REFERENCES estadias(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE SET NULL,
    FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Estadia access logs
CREATE TABLE IF NOT EXISTS estadia_access_logs (
    id TEXT PRIMARY KEY,
    estadia_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    access_type TEXT NOT NULL CHECK (access_type IN ('entry', 'exit', 'denied', 'granted')),
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    location_latitude REAL,
    location_longitude REAL,
    mesh_identity_id TEXT, -- If accessed via mesh network
    notes TEXT,
    FOREIGN KEY (estadia_id) REFERENCES estadias(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (mesh_identity_id) REFERENCES mesh_identities(id) ON DELETE SET NULL
);

-- Offline sync queue
-- Queues data for synchronization when internet connection is restored
CREATE TABLE IF NOT EXISTS offline_sync_queue (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    identity_id TEXT, -- Mesh identity if applicable
    sync_type TEXT NOT NULL CHECK (sync_type IN ('message', 'presence', 'access_log', 'ticket_scan', 'estadia_access')),
    data TEXT NOT NULL, -- JSON object with data to sync
    priority INTEGER DEFAULT 5, -- 1-10, higher number = higher priority
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_attempt DATETIME,
    attempt_count INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 5,
    is_processed BOOLEAN DEFAULT 0,
    processed_at DATETIME,
    error_message TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (identity_id) REFERENCES mesh_identities(id) ON DELETE SET NULL
);

-- Mesh network statistics
CREATE TABLE IF NOT EXISTS mesh_network_stats (
    id TEXT PRIMARY KEY,
    festival_id TEXT NOT NULL,
    date DATE NOT NULL,
    total_peers INTEGER DEFAULT 0,
    active_sessions INTEGER DEFAULT 0,
    messages_sent INTEGER DEFAULT 0,
    messages_received INTEGER DEFAULT 0,
    bytes_transferred INTEGER DEFAULT 0,
    avg_hop_count REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(festival_id, date),
    FOREIGN KEY (festival_id) REFERENCES festivals(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_mesh_identities_fingerprint ON mesh_identities(fingerprint);
CREATE INDEX IF NOT EXISTS idx_mesh_identities_user_id ON mesh_identities(user_id);
CREATE INDEX IF NOT EXISTS idx_mesh_identities_festival_id ON mesh_identities(festival_id);
CREATE INDEX IF NOT EXISTS idx_mesh_sessions_local_identity ON mesh_sessions(local_identity_id);
CREATE INDEX IF NOT EXISTS idx_mesh_sessions_remote_identity ON mesh_sessions(remote_identity_id);
CREATE INDEX IF NOT EXISTS idx_mesh_sessions_active ON mesh_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_mesh_messages_sender ON mesh_messages(sender_identity_id);
CREATE INDEX IF NOT EXISTS idx_mesh_messages_recipient ON mesh_messages(recipient_identity_id);
CREATE INDEX IF NOT EXISTS idx_mesh_messages_room ON mesh_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_mesh_messages_timestamp ON mesh_messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_mesh_messages_delivered ON mesh_messages(is_delivered);
CREATE INDEX IF NOT EXISTS idx_mesh_rooms_festival ON mesh_rooms(festival_id);
CREATE INDEX IF NOT EXISTS idx_mesh_rooms_geohash ON mesh_rooms(geohash);
CREATE INDEX IF NOT EXISTS idx_estadias_festival ON estadias(festival_id);
CREATE INDEX IF NOT EXISTS idx_estadias_type ON estadias(type);
CREATE INDEX IF NOT EXISTS idx_estadia_access_user ON estadia_access(user_id);
CREATE INDEX IF NOT EXISTS idx_estadia_access_estadia ON estadia_access(estadia_id);
CREATE INDEX IF NOT EXISTS idx_estadia_access_active ON estadia_access(is_active);
CREATE INDEX IF NOT EXISTS idx_estadia_access_logs_estadia ON estadia_access_logs(estadia_id);
CREATE INDEX IF NOT EXISTS idx_estadia_access_logs_user ON estadia_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_estadia_access_logs_timestamp ON estadia_access_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_offline_sync_queue_user ON offline_sync_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_offline_sync_queue_processed ON offline_sync_queue(is_processed);
CREATE INDEX IF NOT EXISTS idx_offline_sync_queue_priority ON offline_sync_queue(priority);
CREATE INDEX IF NOT EXISTS idx_mesh_network_stats_festival_date ON mesh_network_stats(festival_id, date);
