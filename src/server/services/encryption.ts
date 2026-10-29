import crypto from 'node:crypto';

// Use ENCRYPTION_KEY from env or generate a deterministic fallback key for dev
const SECRET = process.env.ENCRYPTION_KEY || 'social-agent-secret-key-32-chars-ok!';
const ALGORITHM = 'aes-256-gcm';

// Derive 32-byte key
function getDerivedKey(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypt a plaintext string using AES-256-GCM
 * Returns string formatted as `ivHex:authTagHex:encryptedHex`
 */
export function encryptData(text: string, customKey?: string): string {
  if (!text) return '';
  const key = getDerivedKey(customKey || SECRET);
  const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt a cipher text string formatted as `ivHex:authTagHex:encryptedHex`
 */
export function decryptData(cipherPayload: string, customKey?: string): string {
  if (!cipherPayload) return '';
  try {
    const parts = cipherPayload.split(':');
    if (parts.length !== 3) {
      // In case unencrypted legacy string was passed in dev/mock
      return cipherPayload;
    }
    const [ivHex, authTagHex, encryptedHex] = parts;
    const key = getDerivedKey(customKey || SECRET);
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return '[Decryption Error]';
  }
}

/**
 * Mask token for safe UI display (e.g. EAAB...8dF2)
 */
export function maskToken(token: string): string {
  if (!token) return '';
  if (token.length <= 10) return '••••••••';
  return `${token.slice(0, 6)}••••${token.slice(-4)}`;
}
