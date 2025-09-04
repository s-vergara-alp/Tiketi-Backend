const cryptoUtils = require('../src/utils/cryptoUtils');

describe('Crypto Utils', () => {
    describe('Noise Key Pair Generation', () => {
        test('should generate a valid Noise key pair', () => {
            const keyPair = cryptoUtils.generateNoiseKeyPair();
            
            expect(keyPair).toHaveProperty('publicKey');
            expect(keyPair).toHaveProperty('privateKey');
            expect(typeof keyPair.publicKey).toBe('string');
            expect(typeof keyPair.privateKey).toBe('string');
            expect(keyPair.publicKey.length).toBeGreaterThan(0);
            expect(keyPair.privateKey.length).toBeGreaterThan(0);
        });

        test('should generate different key pairs on each call', () => {
            const keyPair1 = cryptoUtils.generateNoiseKeyPair();
            const keyPair2 = cryptoUtils.generateNoiseKeyPair();
            
            expect(keyPair1.publicKey).not.toBe(keyPair2.publicKey);
            expect(keyPair1.privateKey).not.toBe(keyPair2.privateKey);
        });

        test('should generate valid hex format keys', () => {
            const keyPair = cryptoUtils.generateNoiseKeyPair();
            const hexRegex = /^[0-9a-f]+$/i;
            
            expect(hexRegex.test(keyPair.publicKey)).toBe(true);
            expect(hexRegex.test(keyPair.privateKey)).toBe(true);
        });
    });

    describe('Signing Key Pair Generation', () => {
        test('should generate a valid signing key pair', () => {
            const keyPair = cryptoUtils.generateSigningKeyPair();
            
            expect(keyPair).toHaveProperty('publicKey');
            expect(keyPair).toHaveProperty('privateKey');
            expect(typeof keyPair.publicKey).toBe('string');
            expect(typeof keyPair.privateKey).toBe('string');
            expect(keyPair.publicKey.length).toBeGreaterThan(0);
            expect(keyPair.privateKey.length).toBeGreaterThan(0);
        });

        test('should generate different signing key pairs on each call', () => {
            const keyPair1 = cryptoUtils.generateSigningKeyPair();
            const keyPair2 = cryptoUtils.generateSigningKeyPair();
            
            expect(keyPair1.publicKey).not.toBe(keyPair2.publicKey);
            expect(keyPair1.privateKey).not.toBe(keyPair2.privateKey);
        });

        test('should generate valid hex format signing keys', () => {
            const keyPair = cryptoUtils.generateSigningKeyPair();
            const hexRegex = /^[0-9a-f]+$/i;
            
            expect(hexRegex.test(keyPair.publicKey)).toBe(true);
            expect(hexRegex.test(keyPair.privateKey)).toBe(true);
        });
    });

    describe('Fingerprint Derivation', () => {
        test('should derive a valid fingerprint from public key', () => {
            const keyPair = cryptoUtils.generateNoiseKeyPair();
            const fingerprint = cryptoUtils.deriveFingerprint(keyPair.publicKey);
            
            expect(typeof fingerprint).toBe('string');
            expect(fingerprint.length).toBe(64); // SHA-256 produces 64 hex characters
            expect(/^[0-9a-f]+$/i.test(fingerprint)).toBe(true);
        });

        test('should derive the same fingerprint for the same public key', () => {
            const keyPair = cryptoUtils.generateNoiseKeyPair();
            const fingerprint1 = cryptoUtils.deriveFingerprint(keyPair.publicKey);
            const fingerprint2 = cryptoUtils.deriveFingerprint(keyPair.publicKey);
            
            expect(fingerprint1).toBe(fingerprint2);
        });

        test('should derive different fingerprints for different public keys', () => {
            const keyPair1 = cryptoUtils.generateNoiseKeyPair();
            const keyPair2 = cryptoUtils.generateNoiseKeyPair();
            
            const fingerprint1 = cryptoUtils.deriveFingerprint(keyPair1.publicKey);
            const fingerprint2 = cryptoUtils.deriveFingerprint(keyPair2.publicKey);
            
            expect(fingerprint1).not.toBe(fingerprint2);
        });

        test('should handle empty or invalid public key gracefully', () => {
            expect(() => cryptoUtils.deriveFingerprint('')).toThrow();
            expect(() => cryptoUtils.deriveFingerprint(null)).toThrow();
            expect(() => cryptoUtils.deriveFingerprint(undefined)).toThrow();
        });
    });

    describe('Data Signing', () => {
        test('should sign data with private key', () => {
            const keyPair = cryptoUtils.generateSigningKeyPair();
            const data = Buffer.from('test data to sign');
            
            const signature = cryptoUtils.signData(keyPair.privateKey, data);
            
            expect(typeof signature).toBe('string');
            expect(signature.length).toBeGreaterThan(0);
            expect(/^[0-9a-f]+$/i.test(signature)).toBe(true);
        });

        test('should produce different signatures for different data', () => {
            const keyPair = cryptoUtils.generateSigningKeyPair();
            const data1 = Buffer.from('first test data');
            const data2 = Buffer.from('second test data');
            
            const signature1 = cryptoUtils.signData(keyPair.privateKey, data1);
            const signature2 = cryptoUtils.signData(keyPair.privateKey, data2);
            
            expect(signature1).not.toBe(signature2);
        });

        test('should produce different signatures with different private keys', () => {
            const keyPair1 = cryptoUtils.generateSigningKeyPair();
            const keyPair2 = cryptoUtils.generateSigningKeyPair();
            const data = Buffer.from('same test data');
            
            const signature1 = cryptoUtils.signData(keyPair1.privateKey, data);
            const signature2 = cryptoUtils.signData(keyPair2.privateKey, data);
            
            expect(signature1).not.toBe(signature2);
        });

        test('should handle empty or invalid data gracefully', () => {
            const keyPair = cryptoUtils.generateSigningKeyPair();
            
            expect(() => cryptoUtils.signData(keyPair.privateKey, null)).toThrow();
            expect(() => cryptoUtils.signData(keyPair.privateKey, undefined)).toThrow();
            expect(() => cryptoUtils.signData('', Buffer.from('test'))).toThrow();
        });
    });

    describe('Signature Verification', () => {
        test('should verify valid signature', () => {
            const keyPair = cryptoUtils.generateSigningKeyPair();
            const data = Buffer.from('test data for verification');
            
            const signature = cryptoUtils.signData(keyPair.privateKey, data);
            const isValid = cryptoUtils.verifySignature(keyPair.publicKey, data, signature);
            
            expect(isValid).toBe(true);
        });

        test('should reject invalid signature', () => {
            const keyPair = cryptoUtils.generateSigningKeyPair();
            const data = Buffer.from('test data for verification');
            const invalidSignature = 'invalid_signature_hex_string';
            
            const isValid = cryptoUtils.verifySignature(keyPair.publicKey, data, invalidSignature);
            
            expect(isValid).toBe(false);
        });

        test('should reject signature for different data', () => {
            const keyPair = cryptoUtils.generateSigningKeyPair();
            const originalData = Buffer.from('original test data');
            const modifiedData = Buffer.from('modified test data');
            
            const signature = cryptoUtils.signData(keyPair.privateKey, originalData);
            const isValid = cryptoUtils.verifySignature(keyPair.publicKey, modifiedData, signature);
            
            expect(isValid).toBe(false);
        });

        test('should reject signature with wrong public key', () => {
            const keyPair1 = cryptoUtils.generateSigningKeyPair();
            const keyPair2 = cryptoUtils.generateSigningKeyPair();
            const data = Buffer.from('test data for verification');
            
            const signature = cryptoUtils.signData(keyPair1.privateKey, data);
            const isValid = cryptoUtils.verifySignature(keyPair2.publicKey, data, signature);
            
            expect(isValid).toBe(false);
        });

        test('should handle empty or invalid parameters gracefully', () => {
            const keyPair = cryptoUtils.generateSigningKeyPair();
            const data = Buffer.from('test data');
            const signature = cryptoUtils.signData(keyPair.privateKey, data);
            
            expect(() => cryptoUtils.verifySignature('', data, signature)).toThrow();
            expect(() => cryptoUtils.verifySignature(keyPair.publicKey, null, signature)).toThrow();
            expect(() => cryptoUtils.verifySignature(keyPair.publicKey, data, '')).toThrow();
        });
    });

    describe('Integration Tests', () => {
        test('should work with complete identity generation flow', () => {
            // Generate Noise key pair
            const noiseKeyPair = cryptoUtils.generateNoiseKeyPair();
            
            // Generate signing key pair
            const signingKeyPair = cryptoUtils.generateSigningKeyPair();
            
            // Derive fingerprint from Noise public key
            const fingerprint = cryptoUtils.deriveFingerprint(noiseKeyPair.publicKey);
            
            // Sign some data
            const testData = Buffer.from('test identity data');
            const signature = cryptoUtils.signData(signingKeyPair.privateKey, testData);
            
            // Verify signature
            const isValid = cryptoUtils.verifySignature(signingKeyPair.publicKey, testData, signature);
            
            // All operations should succeed
            expect(noiseKeyPair.publicKey).toBeDefined();
            expect(signingKeyPair.publicKey).toBeDefined();
            expect(fingerprint).toBeDefined();
            expect(signature).toBeDefined();
            expect(isValid).toBe(true);
        });

        test('should maintain consistency across multiple operations', () => {
            const keyPair = cryptoUtils.generateSigningKeyPair();
            const data = Buffer.from('consistency test data');
            
            // Sign the same data multiple times
            const signature1 = cryptoUtils.signData(keyPair.privateKey, data);
            const signature2 = cryptoUtils.signData(keyPair.privateKey, data);
            
            // Signatures should be the same (deterministic)
            expect(signature1).toBe(signature2);
            
            // Both should verify correctly
            const isValid1 = cryptoUtils.verifySignature(keyPair.publicKey, data, signature1);
            const isValid2 = cryptoUtils.verifySignature(keyPair.publicKey, data, signature2);
            
            expect(isValid1).toBe(true);
            expect(isValid2).toBe(true);
        });
    });
});
