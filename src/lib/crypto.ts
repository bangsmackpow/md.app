/**
 * End-to-End Encryption (E2EE) Utility
 * Uses Web Crypto API for secure client-side encryption.
 */

export interface EncryptedData {
  iv: string;
  ciphertext: string;
}

/**
 * Derives a cryptographic key from a passphrase and salt using PBKDF2.
 */
export async function deriveVaultKey(passphrase: string, saltHex: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passphraseBuf = encoder.encode(passphrase);
  
  const salt = new Uint8Array(saltHex.length / 2);
  for (let i = 0; i < saltHex.length; i += 2) {
    salt[i / 2] = parseInt(saltHex.substring(i, i + 2), 16);
  }

  // 1. Import raw passphrase
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    passphraseBuf,
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  // 2. Derive AES-GCM key
  return await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts a string using AES-GCM.
 */
export async function encryptText(text: string, key: CryptoKey): Promise<EncryptedData> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  
  // Generate random 12-byte IV
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const ciphertextBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );

  return {
    iv: Buffer.from(iv).toString('base64'),
    ciphertext: Buffer.from(ciphertextBuf).toString('base64')
  };
}

/**
 * Decrypts an EncryptedData object back to plain text.
 */
export async function decryptText(encrypted: EncryptedData, key: CryptoKey): Promise<string> {
  const iv = new Uint8Array(Buffer.from(encrypted.iv, 'base64'));
  const ciphertext = new Uint8Array(Buffer.from(encrypted.ciphertext, 'base64'));

  const decryptedBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuf);
}

/**
 * Generates a random salt for a new vault.
 */
export function generateSalt(): string {
  const buf = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
}
