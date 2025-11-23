-- Tiikii Festival Database Schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    avatar TEXT,
    phone TEXT,
    date_of_birth TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    is_active BOOLEAN DEFAULT 1,
    is_verified BOOLEAN DEFAULT 0,
    is_admin BOOLEAN DEFAULT 0,
    is_staff BOOLEAN DEFAULT 0,
    is_security BOOLEAN DEFAULT 0,
    role TEXT DEFAULT 'user', -- 'user', 'staff', 'security', 'admin'
    preferences TEXT, -- JSON string for user preferences
    biometric_enrolled BOOLEAN DEFAULT 0,
    biometric_consent_at DATETIME,
    biometric_consent_version TEXT
);

-- Email verification tokens table
CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Biometric data table
CREATE TABLE IF NOT EXISTS biometric_data (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    biometric_type TEXT NOT NULL CHECK (biometric_type IN ('face', 'fingerprint', 'voice', 'iris')),
    template_data TEXT NOT NULL, -- Encrypted biometric template
    template_hash TEXT NOT NULL, -- Hash for integrity verification
    encryption_key_id TEXT NOT NULL, -- Reference to encryption key used
    quality_score REAL, -- Biometric quality score
    enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used_at DATETIME,
    is_active BOOLEAN DEFAULT 1,
    metadata TEXT, -- JSON with additional biometric metadata
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- BLE beacons table
CREATE TABLE IF NOT EXISTS ble_beacons (
    id TEXT PRIMARY KEY,
    festival_id TEXT NOT NULL,
    name TEXT NOT NULL,
    location_name TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    mac_address TEXT UNIQUE NOT NULL,
    uuid TEXT NOT NULL,
    major INTEGER NOT NULL,
    minor INTEGER NOT NULL,
    tx_power INTEGER DEFAULT -59,
    rssi_threshold INTEGER DEFAULT -70,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (festival_id) REFERENCES festivals(id) ON DELETE CASCADE
);

-- BLE validation sessions table
CREATE TABLE IF NOT EXISTS ble_validation_sessions (
    id TEXT PRIMARY KEY,
    beacon_id TEXT NOT NULL,
    user_id TEXT,
    device_id TEXT,
    session_token TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'validated', 'expired', 'cancelled')),
    proximity_data TEXT, -- JSON with RSSI, distance, etc.
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    validated_at DATETIME,
    FOREIGN KEY (beacon_id) REFERENCES ble_beacons(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Secure QR codes table
CREATE TABLE IF NOT EXISTS secure_qr_codes (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL,
    qr_payload TEXT UNIQUE NOT NULL,
    encrypted_data TEXT NOT NULL, -- Encrypted ticket data
    signature TEXT NOT NULL, -- HMAC signature
    nonce TEXT NOT NULL, -- Encryption nonce
    expires_at DATETIME NOT NULL,
    is_used BOOLEAN DEFAULT 0,
    used_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
);

-- Ticket validations table
CREATE TABLE IF NOT EXISTS ticket_validations (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL,
    qr_payload TEXT UNIQUE NOT NULL,
    validated_at DATETIME NOT NULL,
    status TEXT DEFAULT 'used' CHECK (status IN ('used', 'invalid', 'expired', 'duplicate')),
    validator_id TEXT, -- Security staff who validated
    beacon_id TEXT, -- BLE beacon used for validation
    location TEXT, -- Physical location of validation
    biometric_verified BOOLEAN DEFAULT 0,
    biometric_confidence REAL, -- Confidence score for biometric match
    validation_method TEXT CHECK (validation_method IN ('qr_only', 'qr_ble', 'qr_biometric', 'qr_ble_biometric')),
    device_info TEXT, -- JSON with device information
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (validator_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (beacon_id) REFERENCES ble_beacons(id) ON DELETE SET NULL
);

-- Encryption keys table for secure data
CREATE TABLE IF NOT EXISTS encryption_keys (
    id TEXT PRIMARY KEY,
    key_type TEXT NOT NULL CHECK (key_type IN ('qr_encryption', 'biometric_encryption', 'session_encryption')),
    key_data TEXT NOT NULL, -- Encrypted key data
    key_version INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    rotated_at DATETIME
);

-- Biometric verification attempts table
CREATE TABLE IF NOT EXISTS biometric_verification_attempts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    session_id TEXT,
    biometric_type TEXT NOT NULL,
    verification_result TEXT NOT NULL CHECK (verification_result IN ('success', 'failure', 'error')),
    confidence_score REAL,
    attempt_data TEXT, -- JSON with attempt metadata
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES ble_validation_sessions(id) ON DELETE SET NULL
);

-- Festivals table
CREATE TABLE IF NOT EXISTS festivals (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    logo TEXT,
    venue TEXT NOT NULL,
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    latitude_delta REAL NOT NULL,
    longitude_delta REAL NOT NULL,
    primary_color TEXT NOT NULL,
    secondary_color TEXT NOT NULL,
    accent_color TEXT NOT NULL,
    background_color TEXT NOT NULL,
    decoration_icons TEXT, -- JSON array of emojis
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1,
    ble_enabled BOOLEAN DEFAULT 1,
    biometric_enabled BOOLEAN DEFAULT 1
);

-- Artists table
CREATE TABLE IF NOT EXISTS artists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    bio TEXT,
    genre TEXT,
    image_url TEXT,
    social_media TEXT, -- JSON object with social media links
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Stages table
CREATE TABLE IF NOT EXISTS stages (
    id TEXT PRIMARY KEY,
    festival_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    capacity INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (festival_id) REFERENCES festivals(id) ON DELETE CASCADE
);

-- Schedule table
CREATE TABLE IF NOT EXISTS schedule (
    id TEXT PRIMARY KEY,
    festival_id TEXT NOT NULL,
    artist_id TEXT NOT NULL,
    stage_id TEXT NOT NULL,
    title TEXT,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (festival_id) REFERENCES festivals(id) ON DELETE CASCADE,
    FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE,
    FOREIGN KEY (stage_id) REFERENCES stages(id) ON DELETE CASCADE
);

-- Ticket templates table
CREATE TABLE IF NOT EXISTS ticket_templates (
    id TEXT PRIMARY KEY,
    festival_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    currency TEXT DEFAULT 'USD',
    benefits TEXT, -- JSON array of benefits
    max_quantity INTEGER,
    current_quantity INTEGER DEFAULT 0,
    is_available BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (festival_id) REFERENCES festivals(id) ON DELETE CASCADE
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    festival_id TEXT NOT NULL,
    template_id TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'USD',
    payment_method_type TEXT NOT NULL,
    payment_method_token TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'success', 'failed', 'cancelled', 'refunded')),
    gateway_transaction_id TEXT,
    gateway_response TEXT, -- JSON object with gateway response
    metadata TEXT, -- JSON object with additional data
    processed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (festival_id) REFERENCES festivals(id) ON DELETE CASCADE,
    FOREIGN KEY (template_id) REFERENCES ticket_templates(id) ON DELETE CASCADE
);

-- Refunds table
CREATE TABLE IF NOT EXISTS refunds (
    id TEXT PRIMARY KEY,
    payment_id TEXT NOT NULL,
    amount REAL NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'success', 'failed')),
    gateway_response TEXT, -- JSON object with gateway response
    processed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
);

-- Tickets table
CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    festival_id TEXT NOT NULL,
    template_id TEXT NOT NULL,
    qr_payload TEXT UNIQUE NOT NULL,
    holder_name TEXT NOT NULL,
    tier TEXT NOT NULL,
    valid_from DATETIME NOT NULL,
    valid_to DATETIME NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired', 'cancelled')),
    price REAL NOT NULL,
    purchase_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    transaction_id TEXT,
    seat_info TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    biometric_required BOOLEAN DEFAULT 0,
    ble_validation_required BOOLEAN DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (festival_id) REFERENCES festivals(id) ON DELETE CASCADE,
    FOREIGN KEY (template_id) REFERENCES ticket_templates(id) ON DELETE CASCADE
);

-- Chat rooms table
CREATE TABLE IF NOT EXISTS chat_rooms (
    id TEXT PRIMARY KEY,
    festival_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'general' CHECK (type IN ('general', 'friends', 'private')),
    avatar TEXT,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1,
    FOREIGN KEY (festival_id) REFERENCES festivals(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    text TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_edited BOOLEAN DEFAULT 0,
    edited_at DATETIME,
    is_deleted BOOLEAN DEFAULT 0,
    deleted_at DATETIME,
    FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Chat room participants table
CREATE TABLE IF NOT EXISTS chat_participants (
    room_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_read_at DATETIME,
    is_admin BOOLEAN DEFAULT 0,
    PRIMARY KEY (room_id, user_id),
    FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Widgets table
CREATE TABLE IF NOT EXISTS widgets (
    id TEXT PRIMARY KEY,
    festival_id TEXT NOT NULL,
    title TEXT NOT NULL,
    subtitle TEXT,
    icon TEXT NOT NULL,
    type TEXT NOT NULL,
    content TEXT, -- JSON object with widget-specific data
    is_active BOOLEAN DEFAULT 1,
    is_live BOOLEAN DEFAULT 0,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
    customizable BOOLEAN DEFAULT 1,
    order_index INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (festival_id) REFERENCES festivals(id) ON DELETE CASCADE
);

-- User widget preferences table
CREATE TABLE IF NOT EXISTS user_widget_preferences (
    user_id TEXT NOT NULL,
    widget_id TEXT NOT NULL,
    is_enabled BOOLEAN DEFAULT 1,
    order_index INTEGER DEFAULT 0,
    custom_settings TEXT, -- JSON object with user-specific widget settings
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, widget_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (widget_id) REFERENCES widgets(id) ON DELETE CASCADE
);

-- Vendors table
CREATE TABLE IF NOT EXISTS vendors (
    id TEXT PRIMARY KEY,
    festival_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('food', 'drink', 'merch', 'atm', 'restroom', 'charging', 'medical', 'security')),
    description TEXT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    hours TEXT,
    rating REAL DEFAULT 0,
    wait_time INTEGER DEFAULT 0, -- in minutes
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (festival_id) REFERENCES festivals(id) ON DELETE CASCADE
);

-- Points of Interest table
CREATE TABLE IF NOT EXISTS points_of_interest (
    id TEXT PRIMARY KEY,
    festival_id TEXT NOT NULL,
    name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('stage', 'info', 'medic', 'entrance', 'exit', 'water', 'locker', 'lostfound', 'charging', 'restroom')),
    description TEXT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (festival_id) REFERENCES festivals(id) ON DELETE CASCADE
);

-- User presence table
CREATE TABLE IF NOT EXISTS user_presence (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    festival_id TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    status TEXT DEFAULT 'online' CHECK (status IN ('online', 'away', 'offline')),
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (festival_id) REFERENCES festivals(id) ON DELETE CASCADE
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    type TEXT DEFAULT 'general' CHECK (type IN ('general', 'schedule', 'emergency', 'social', 'ticket')),
    data TEXT, -- JSON object with additional data
    is_read BOOLEAN DEFAULT 0,
    scheduled_at DATETIME,
    sent_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- User favorites table
CREATE TABLE IF NOT EXISTS user_favorites (
    user_id TEXT NOT NULL,
    artist_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, artist_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE
);

-- Offline queue table
CREATE TABLE IF NOT EXISTS offline_queue (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('message', 'favorite', 'location', 'notification')),
    data TEXT NOT NULL, -- JSON object with the data to sync
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    retries INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    is_processed BOOLEAN DEFAULT 0,
    processed_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Map tiles table for offline maps
CREATE TABLE IF NOT EXISTS map_tiles (
    id TEXT PRIMARY KEY,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    z INTEGER NOT NULL,
    url TEXT NOT NULL,
    local_path TEXT,
    downloaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    UNIQUE(x, y, z)
);

-- Geofences table
CREATE TABLE IF NOT EXISTS geofences (
    id TEXT PRIMARY KEY,
    festival_id TEXT NOT NULL,
    stage_id TEXT,
    name TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    radius REAL NOT NULL, -- in meters
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (festival_id) REFERENCES festivals(id) ON DELETE CASCADE,
    FOREIGN KEY (stage_id) REFERENCES stages(id) ON DELETE SET NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_festival_id ON tickets(festival_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_festival_id ON payments(festival_id);
CREATE INDEX IF NOT EXISTS idx_refunds_payment_id ON refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id ON chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON chat_messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_schedule_festival_id ON schedule(festival_id);
CREATE INDEX IF NOT EXISTS idx_schedule_start_time ON schedule(start_time);
CREATE INDEX IF NOT EXISTS idx_widgets_festival_id ON widgets(festival_id);
CREATE INDEX IF NOT EXISTS idx_widgets_type ON widgets(type);
CREATE INDEX IF NOT EXISTS idx_user_presence_user_id ON user_presence(user_id);
CREATE INDEX IF NOT EXISTS idx_user_presence_festival_id ON user_presence(festival_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_offline_queue_user_id ON offline_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_offline_queue_is_processed ON offline_queue(is_processed);

-- Email verification tokens indexes
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id ON email_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_token ON email_verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_email ON email_verification_tokens(email);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_expires_at ON email_verification_tokens(expires_at);

-- BLE and biometric indexes
CREATE INDEX IF NOT EXISTS idx_biometric_data_user_id ON biometric_data(user_id);
CREATE INDEX IF NOT EXISTS idx_biometric_data_type ON biometric_data(biometric_type);
CREATE INDEX IF NOT EXISTS idx_ble_beacons_festival_id ON ble_beacons(festival_id);
CREATE INDEX IF NOT EXISTS idx_ble_beacons_mac_address ON ble_beacons(mac_address);
CREATE INDEX IF NOT EXISTS idx_ble_validation_sessions_beacon_id ON ble_validation_sessions(beacon_id);
CREATE INDEX IF NOT EXISTS idx_ble_validation_sessions_user_id ON ble_validation_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ble_validation_sessions_status ON ble_validation_sessions(status);
CREATE INDEX IF NOT EXISTS idx_secure_qr_codes_ticket_id ON secure_qr_codes(ticket_id);
CREATE INDEX IF NOT EXISTS idx_secure_qr_codes_qr_payload ON secure_qr_codes(qr_payload);
CREATE INDEX IF NOT EXISTS idx_ticket_validations_ticket_id ON ticket_validations(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_validations_qr_payload ON ticket_validations(qr_payload);
CREATE INDEX IF NOT EXISTS idx_ticket_validations_validated_at ON ticket_validations(validated_at);
CREATE INDEX IF NOT EXISTS idx_biometric_verification_attempts_user_id ON biometric_verification_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_biometric_verification_attempts_session_id ON biometric_verification_attempts(session_id);
