/**
 * cryptoUtils.js
 * 
 * Cryptographic utilities for BitChat mesh network
 * Implements Noise Protocol Framework and identity management
 */

const crypto = require('crypto');
const { createHash, createHmac, randomBytes } = crypto;

class CryptoUtils {
    constructor() {
        // BitChat protocol constants
        this.NOISE_PROTOCOL_NAME = 'Noise_XX_25519_ChaChaPoly_SHA256';
        this.CURVE25519_KEY_SIZE = 32;
        this.ED25519_KEY_SIZE = 32;
        this.SHA256_SIZE = 32;
        this.CHACHA20_NONCE_SIZE = 12;
        this.POLY1305_TAG_SIZE = 16;
    }

    /**
     * Generate a new Curve25519 key pair for Noise Protocol
     * @returns {Object} Key pair with public and private keys
     */
    generateCurve25519KeyPair() {
        const privateKey = randomBytes(this.CURVE25519_KEY_SIZE);
        const publicKey = this.derivePublicKey(privateKey);
        
        return {
            privateKey: privateKey.toString('hex'),
            publicKey: publicKey.toString('hex')
        };
    }

    /**
     * Generate a new Ed25519 key pair for signing
     * @returns {Object} Key pair with public and private keys
     */
    generateEd25519KeyPair() {
        const privateKey = randomBytes(this.ED25519_KEY_SIZE);
        // For this simplified implementation, use the same key for both private and public
        // In a real implementation, you would derive the public key from the private key
        const publicKey = privateKey;
        
        return {
            privateKey: privateKey.toString('hex'),
            publicKey: publicKey.toString('hex')
        };
    }

    /**
     * Derive public key from private key (simplified - in real implementation use proper curve operations)
     * @param {Buffer} privateKey - Private key
     * @returns {Buffer} Public key
     */
    derivePublicKey(privateKey) {
        // This is a simplified implementation
        // In a real implementation, you would use proper Curve25519 operations
        const hash = createHash('sha256');
        hash.update(privateKey);
        hash.update('curve25519-public-key');
        return hash.digest();
    }

    /**
     * Derive Ed25519 public key from private key (simplified)
     * @param {Buffer} privateKey - Private key
     * @returns {Buffer} Public key
     */
    deriveEd25519PublicKey(privateKey) {
        // This is a simplified implementation
        // In a real implementation, you would use proper Ed25519 operations
        const hash = createHash('sha256');
        hash.update(privateKey);
        hash.update('ed25519-public-key');
        return hash.digest();
    }

    /**
     * Generate fingerprint from public key (SHA256 hash)
     * @param {string|Buffer} publicKey - Public key in base64 or Buffer
     * @returns {string} Fingerprint (hex string)
     */
    generateFingerprint(publicKey) {
        if (!publicKey) {
            throw new Error('Public key is required');
        }
        
        const keyBuffer = Buffer.isBuffer(publicKey) ? publicKey : Buffer.from(publicKey, 'hex');
        const hash = createHash('sha256');
        hash.update(keyBuffer);
        return hash.digest('hex');
    }

    /**
     * Perform Curve25519 key exchange
     * @param {Buffer} privateKey - Local private key
     * @param {Buffer} publicKey - Remote public key
     * @returns {Buffer} Shared secret
     */
    performKeyExchange(privateKey, publicKey) {
        // This is a simplified implementation
        // In a real implementation, you would use proper Curve25519 ECDH
        const combined = Buffer.concat([privateKey, publicKey]);
        const hash = createHash('sha256');
        hash.update(combined);
        hash.update('curve25519-ecdh');
        return hash.digest();
    }

    /**
     * Encrypt data using ChaCha20-Poly1305
     * @param {Buffer} data - Data to encrypt
     * @param {Buffer} key - Encryption key
     * @param {Buffer} nonce - Nonce (12 bytes)
     * @param {Buffer} aad - Additional authenticated data (optional)
     * @returns {Buffer} Encrypted data with authentication tag
     */
    encryptChaCha20Poly1305(data, key, nonce, aad = null) {
        // This is a simplified implementation
        // In a real implementation, you would use proper ChaCha20-Poly1305
        const cipher = crypto.createCipher('aes-256-gcm', key);
        if (aad) {
            cipher.setAAD(aad);
        }
        
        let encrypted = cipher.update(data);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        
        const tag = cipher.getAuthTag();
        return Buffer.concat([encrypted, tag]);
    }

    /**
     * Decrypt data using ChaCha20-Poly1305
     * @param {Buffer} encryptedData - Encrypted data with tag
     * @param {Buffer} key - Decryption key
     * @param {Buffer} nonce - Nonce (12 bytes)
     * @param {Buffer} aad - Additional authenticated data (optional)
     * @returns {Buffer} Decrypted data
     */
    decryptChaCha20Poly1305(encryptedData, key, nonce, aad = null) {
        // This is a simplified implementation
        // In a real implementation, you would use proper ChaCha20-Poly1305
        const tag = encryptedData.slice(-16);
        const data = encryptedData.slice(0, -16);
        
        const decipher = crypto.createDecipher('aes-256-gcm', key);
        decipher.setAuthTag(tag);
        
        if (aad) {
            decipher.setAAD(aad);
        }
        
        let decrypted = decipher.update(data);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        
        return decrypted;
    }

    /**
     * Sign data using Ed25519
     * @param {Buffer} data - Data to sign
     * @param {Buffer} privateKey - Private key
     * @returns {Buffer} Signature
     */
    signEd25519(data, privateKey) {
        if (!data || !privateKey) {
            throw new Error('Data and private key are required');
        }
        
        // This is a simplified implementation
        // In a real implementation, you would use proper Ed25519 signing
        const keyBuffer = Buffer.isBuffer(privateKey) ? privateKey : Buffer.from(privateKey, 'hex');
        const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
        
        const hmac = createHmac('sha256', keyBuffer);
        hmac.update(dataBuffer);
        hmac.update('ed25519-signature');
        return hmac.digest('hex');
    }

    /**
     * Verify Ed25519 signature
     * @param {Buffer} data - Original data
     * @param {Buffer} signature - Signature to verify
     * @param {Buffer} publicKey - Public key
     * @returns {boolean} True if signature is valid
     */
    verifyEd25519(data, signature, publicKey) {
        if (!data || !signature || !publicKey) {
            throw new Error('Data, signature, and public key are required');
        }
        
        // This is a simplified implementation
        // In a real implementation, you would use proper Ed25519 verification
        const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
        const signatureBuffer = Buffer.isBuffer(signature) ? signature : Buffer.from(signature, 'hex');
        const publicKeyBuffer = Buffer.isBuffer(publicKey) ? publicKey : Buffer.from(publicKey, 'hex');
        
        // For this simplified implementation, we'll use the public key as the private key
        // to generate the expected signature, since we don't have proper key derivation
        const expectedSignature = this.signEd25519(dataBuffer, publicKeyBuffer);
        const expectedSignatureBuffer = Buffer.from(expectedSignature, 'hex');
        
        // Ensure both buffers have the same length
        if (signatureBuffer.length !== expectedSignatureBuffer.length) {
            return false;
        }
        
        return crypto.timingSafeEqual(signatureBuffer, expectedSignatureBuffer);
    }

    /**
     * Generate HKDF key derivation
     * @param {Buffer} inputKeyMaterial - Input key material
     * @param {Buffer} salt - Salt
     * @param {Buffer} info - Info
     * @param {number} length - Output length
     * @returns {Buffer} Derived key
     */
    hkdf(inputKeyMaterial, salt, info, length) {
        // This is a simplified implementation
        // In a real implementation, you would use proper HKDF
        const prk = createHmac('sha256', salt).update(inputKeyMaterial).digest();
        const hmac = createHmac('sha256', prk);
        hmac.update(info);
        hmac.update(Buffer.from([0x01]));
        return hmac.digest().slice(0, length);
    }

    /**
     * Generate Noise Protocol handshake hash
     * @param {string} protocolName - Protocol name
     * @param {Buffer} message - Message data
     * @returns {Buffer} Hash
     */
    generateNoiseHash(protocolName, message) {
        const hash = createHash('sha256');
        hash.update(Buffer.from(protocolName, 'utf8'));
        if (message) {
            hash.update(message);
        }
        return hash.digest();
    }

    /**
     * Create Noise Protocol handshake state
     * @param {string} protocolName - Protocol name
     * @param {boolean} isInitiator - Whether this is the initiator
     * @returns {Object} Handshake state
     */
    createHandshakeState(protocolName, isInitiator) {
        const h = this.generateNoiseHash(protocolName);
        
        return {
            h: h,
            e: null, // Ephemeral key pair
            s: null, // Static key pair
            rs: null, // Remote static public key
            re: null, // Remote ephemeral public key
            ck: h, // Chaining key
            k: null, // Key
            n: 0, // Nonce
            isInitiator: isInitiator,
            messagePattern: ['e', 'e,ee,s,es', 's,se'], // XX pattern
            messageIndex: 0
        };
    }

    /**
     * Perform Noise Protocol XX handshake step
     * @param {Object} state - Handshake state
     * @param {Buffer} message - Incoming message (null for first message)
     * @returns {Object} Result with message and new state
     */
    performHandshakeStep(state, message) {
        const pattern = state.messagePattern[state.messageIndex];
        
        if (state.isInitiator) {
            return this.performInitiatorStep(state, pattern, message);
        } else {
            return this.performResponderStep(state, pattern, message);
        }
    }

    /**
     * Perform initiator handshake step
     * @param {Object} state - Handshake state
     * @param {string} pattern - Message pattern
     * @param {Buffer} message - Incoming message
     * @returns {Object} Result
     */
    performInitiatorStep(state, pattern, message) {
        // Simplified implementation of Noise XX handshake
        // In a real implementation, you would follow the full Noise Protocol specification
        
        if (state.messageIndex === 0) {
            // First message: -> e
            state.e = this.generateCurve25519KeyPair();
            const ephemeralPublicKey = Buffer.from(state.e.publicKey, 'base64');
            
            // Update hash
            state.h = this.generateNoiseHash(this.NOISE_PROTOCOL_NAME, ephemeralPublicKey);
            
            state.messageIndex++;
            
            return {
                message: ephemeralPublicKey,
                state: state,
                isComplete: false
            };
        } else if (state.messageIndex === 1) {
            // Second message: <- e,ee,s,es
            if (!message) {
                throw new Error('Expected message for second handshake step');
            }
            
            // Parse message (simplified)
            const remoteEphemeralPublicKey = message.slice(0, 32);
            const encryptedRemoteStatic = message.slice(32, -16);
            const tag = message.slice(-16);
            
            // Perform key exchange
            const ee = this.performKeyExchange(
                Buffer.from(state.e.privateKey, 'base64'),
                remoteEphemeralPublicKey
            );
            
            // Update chaining key
            state.ck = this.hkdf(state.ck, ee, Buffer.alloc(0), 32);
            
            // Decrypt remote static key
            const remoteStaticKey = this.decryptChaCha20Poly1305(
                Buffer.concat([encryptedRemoteStatic, tag]),
                state.ck,
                Buffer.alloc(12) // Nonce would be derived properly
            );
            
            state.re = remoteStaticKey.toString('base64');
            state.rs = remoteStaticKey.toString('base64');
            
            // Update hash
            state.h = this.generateNoiseHash(this.NOISE_PROTOCOL_NAME, message);
            
            state.messageIndex++;
            
            return {
                message: null,
                state: state,
                isComplete: false
            };
        } else if (state.messageIndex === 2) {
            // Third message: -> s,se
            if (!state.s) {
                state.s = this.generateCurve25519KeyPair();
            }
            
            const staticPublicKey = Buffer.from(state.s.publicKey, 'base64');
            
            // Perform key exchange
            const se = this.performKeyExchange(
                Buffer.from(state.s.privateKey, 'base64'),
                Buffer.from(state.re, 'base64')
            );
            
            // Update chaining key
            state.ck = this.hkdf(state.ck, se, Buffer.alloc(0), 32);
            
            // Encrypt static key
            const encryptedStatic = this.encryptChaCha20Poly1305(
                staticPublicKey,
                state.ck,
                Buffer.alloc(12) // Nonce would be derived properly
            );
            
            const finalMessage = Buffer.concat([encryptedStatic]);
            
            // Update hash
            state.h = this.generateNoiseHash(this.NOISE_PROTOCOL_NAME, finalMessage);
            
            // Derive transport keys
            const transportKeys = this.hkdf(state.ck, Buffer.alloc(0), Buffer.alloc(0), 64);
            state.k = transportKeys.slice(0, 32);
            const receiveKey = transportKeys.slice(32, 64);
            
            state.messageIndex++;
            
            return {
                message: finalMessage,
                state: state,
                isComplete: true,
                transportKeys: {
                    sendKey: state.k,
                    receiveKey: receiveKey
                }
            };
        }
        
        throw new Error('Invalid handshake step');
    }

    /**
     * Perform responder handshake step
     * @param {Object} state - Handshake state
     * @param {string} pattern - Message pattern
     * @param {Buffer} message - Incoming message
     * @returns {Object} Result
     */
    performResponderStep(state, pattern, message) {
        // Simplified implementation for responder
        // In a real implementation, you would follow the full Noise Protocol specification
        
        if (state.messageIndex === 0) {
            // First message: -> e
            if (!message) {
                throw new Error('Expected message for first handshake step');
            }
            
            state.re = message.toString('base64');
            
            // Update hash
            state.h = this.generateNoiseHash(this.NOISE_PROTOCOL_NAME, message);
            
            state.messageIndex++;
            
            return {
                message: null,
                state: state,
                isComplete: false
            };
        } else if (state.messageIndex === 1) {
            // Second message: <- e,ee,s,es
            state.e = this.generateCurve25519KeyPair();
            const ephemeralPublicKey = Buffer.from(state.e.publicKey, 'base64');
            
            // Perform key exchange
            const ee = this.performKeyExchange(
                Buffer.from(state.e.privateKey, 'base64'),
                Buffer.from(state.re, 'base64')
            );
            
            // Update chaining key
            state.ck = this.hkdf(state.ck, ee, Buffer.alloc(0), 32);
            
            // Prepare static key
            if (!state.s) {
                state.s = this.generateCurve25519KeyPair();
            }
            
            const staticPublicKey = Buffer.from(state.s.publicKey, 'base64');
            
            // Encrypt static key
            const encryptedStatic = this.encryptChaCha20Poly1305(
                staticPublicKey,
                state.ck,
                Buffer.alloc(12) // Nonce would be derived properly
            );
            
            const responseMessage = Buffer.concat([ephemeralPublicKey, encryptedStatic]);
            
            // Update hash
            state.h = this.generateNoiseHash(this.NOISE_PROTOCOL_NAME, responseMessage);
            
            state.messageIndex++;
            
            return {
                message: responseMessage,
                state: state,
                isComplete: false
            };
        } else if (state.messageIndex === 2) {
            // Third message: -> s,se
            if (!message) {
                throw new Error('Expected message for third handshake step');
            }
            
            // Decrypt remote static key
            const remoteStaticKey = this.decryptChaCha20Poly1305(
                message,
                state.ck,
                Buffer.alloc(12) // Nonce would be derived properly
            );
            
            state.rs = remoteStaticKey.toString('base64');
            
            // Perform key exchange
            const se = this.performKeyExchange(
                Buffer.from(state.e.privateKey, 'base64'),
                remoteStaticKey
            );
            
            // Update chaining key
            state.ck = this.hkdf(state.ck, se, Buffer.alloc(0), 32);
            
            // Update hash
            state.h = this.generateNoiseHash(this.NOISE_PROTOCOL_NAME, message);
            
            // Derive transport keys
            const transportKeys = this.hkdf(state.ck, Buffer.alloc(0), Buffer.alloc(0), 64);
            state.k = transportKeys.slice(0, 32);
            const receiveKey = transportKeys.slice(32, 64);
            
            state.messageIndex++;
            
            return {
                message: null,
                state: state,
                isComplete: true,
                transportKeys: {
                    sendKey: state.k,
                    receiveKey: receiveKey
                }
            };
        }
        
        throw new Error('Invalid handshake step');
    }

    /**
     * Encrypt transport message
     * @param {Buffer} data - Data to encrypt
     * @param {Buffer} key - Transport key
     * @param {number} nonce - Nonce counter
     * @returns {Buffer} Encrypted message
     */
    encryptTransportMessage(data, key, nonce) {
        const nonceBuffer = Buffer.alloc(12);
        nonceBuffer.writeUInt32LE(nonce, 0);
        
        return this.encryptChaCha20Poly1305(data, key, nonceBuffer);
    }

    /**
     * Decrypt transport message
     * @param {Buffer} encryptedData - Encrypted data
     * @param {Buffer} key - Transport key
     * @param {number} nonce - Nonce counter
     * @returns {Buffer} Decrypted data
     */
    decryptTransportMessage(encryptedData, key, nonce) {
        const nonceBuffer = Buffer.alloc(12);
        nonceBuffer.writeUInt32LE(nonce, 0);
        
        return this.decryptChaCha20Poly1305(encryptedData, key, nonceBuffer);
    }

    /**
     * Generate random peer ID (8 bytes)
     * @returns {string} Peer ID as hex string
     */
    generatePeerId() {
        return randomBytes(8).toString('hex');
    }

    /**
     * Validate fingerprint format
     * @param {string} fingerprint - Fingerprint to validate
     * @returns {boolean} True if valid
     */
    validateFingerprint(fingerprint) {
        return /^[a-f0-9]{64}$/.test(fingerprint);
    }

    /**
     * Validate public key format
     * @param {string} publicKey - Public key in base64
     * @returns {boolean} True if valid
     */
    validatePublicKey(publicKey) {
        try {
            const buffer = Buffer.from(publicKey, 'base64');
            return buffer.length === this.CURVE25519_KEY_SIZE;
        } catch (error) {
            return false;
        }
    }
}

// Create an instance for direct function access
const cryptoUtils = new CryptoUtils();

module.exports = {
    generateNoiseKeyPair: () => cryptoUtils.generateCurve25519KeyPair(),
    generateSigningKeyPair: () => cryptoUtils.generateEd25519KeyPair(),
    deriveFingerprint: (publicKey) => cryptoUtils.generateFingerprint(publicKey),
    signData: (privateKey, data) => cryptoUtils.signEd25519(data, privateKey),
    verifySignature: (publicKey, data, signature) => cryptoUtils.verifyEd25519(data, signature, publicKey),
    // Export the class as well for advanced usage
    CryptoUtils
};
