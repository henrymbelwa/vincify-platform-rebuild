import crypto from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12

function getMasterKey(): Buffer {
  const secret = process.env['AI_ENCRYPTION_SECRET'] || process.env['SUPABASE_SERVICE_ROLE_KEY'] || 'vincify-default-secret-salt-32chars!'
  return crypto.createHash('sha256').update(secret).digest()
}

/** Encrypts a plaintext secret into an IV:AuthTag:Ciphertext string */
export function encryptSecret(plainText: string): string {
  if (!plainText) return ''
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, getMasterKey(), iv)
  let encrypted = cipher.update(plainText, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const tag = cipher.getAuthTag().toString('hex')
  return `${iv.toString('hex')}:${tag}:${encrypted}`
}

/** Decrypts an IV:AuthTag:Ciphertext string back to plaintext */
export function decryptSecret(cipherTextWithMeta: string): string {
  if (!cipherTextWithMeta) return ''
  const parts = cipherTextWithMeta.split(':')
  if (parts.length !== 3) return cipherTextWithMeta // Fallback if plain
  const [ivHex, tagHex, encryptedHex] = parts
  const iv = Buffer.from(ivHex!, 'hex')
  const tag = Buffer.from(tagHex!, 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, getMasterKey(), iv)
  decipher.setAuthTag(tag)
  let decrypted = decipher.update(encryptedHex!, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}
