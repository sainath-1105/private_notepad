/**
 * Crypto utility for End-to-End Encryption
 */

const SecureCrypto = {
    PBKDF2_ITERATIONS: 100000,
    SALT_SIZE: 16,
    IV_SIZE: 12,

    async deriveKey(password, salt) {
        const encoder = new TextEncoder();
        const baseKey = await crypto.subtle.importKey(
            "raw",
            encoder.encode(password),
            "PBKDF2",
            false,
            ["deriveKey"]
        );

        return crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt: salt,
                iterations: this.PBKDF2_ITERATIONS,
                hash: "SHA-256"
            },
            baseKey,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt", "decrypt"]
        );
    },

    async encrypt(text, password) {
        const encoder = new TextEncoder();
        const salt = crypto.getRandomValues(new Uint8Array(this.SALT_SIZE));
        const iv = crypto.getRandomValues(new Uint8Array(this.IV_SIZE));
        const key = await this.deriveKey(password, salt);

        const encryptedContent = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv },
            key,
            encoder.encode(text)
        );

        // Convert to Base64 for easy transport/storage
        const combined = new Uint8Array(this.SALT_SIZE + this.IV_SIZE + encryptedContent.byteLength);
        combined.set(salt, 0);
        combined.set(iv, this.SALT_SIZE);
        combined.set(new Uint8Array(encryptedContent), this.SALT_SIZE + this.IV_SIZE);

        return this.arrayBufferToBase64(combined);
    },

    async decrypt(base64Data, password) {
        const data = this.base64ToArrayBuffer(base64Data);
        const salt = data.slice(0, this.SALT_SIZE);
        const iv = data.slice(this.SALT_SIZE, this.SALT_SIZE + this.IV_SIZE);
        const encryptedContent = data.slice(this.SALT_SIZE + this.IV_SIZE);

        const key = await this.deriveKey(password, salt);

        try {
            const decrypted = await crypto.subtle.decrypt(
                { name: "AES-GCM", iv: iv },
                key,
                encryptedContent
            );
            return new TextDecoder().decode(decrypted);
        } catch (e) {
            throw new Error("Invalid password/corrupted data");
        }
    },

    arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    },

    base64ToArrayBuffer(base64) {
        const binary_string = window.atob(base64);
        const len = binary_string.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary_string.charCodeAt(i);
        }
        return bytes.buffer;
    },

    async getHash(text) {
        const msgUint8 = new TextEncoder().encode(text);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
};
