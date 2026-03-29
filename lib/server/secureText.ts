import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from "crypto"

function getSecretKey() {
  const raw = process.env.EXAM_SECRET_KEY || ""
  if (!raw) throw new Error("EXAM_SECRET_KEY is not set")
  return createHash("sha256").update(raw).digest()
}

export function hashSecret(plainText: string) {
  const salt = randomBytes(16).toString("hex")
  const key = scryptSync(plainText, salt, 64).toString("hex")
  return `scrypt$${salt}$${key}`
}

export function encryptSecret(plainText: string) {
  const iv = randomBytes(12)
  const key = getSecretKey()
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`
}

export function decryptSecret(payload: string) {
  const [ivText, tagText, bodyText] = String(payload || "").split(".")
  if (!ivText || !tagText || !bodyText) {
    throw new Error("Encrypted credential payload is invalid")
  }

  const key = getSecretKey()
  const iv = Buffer.from(ivText, "base64url")
  const tag = Buffer.from(tagText, "base64url")
  const body = Buffer.from(bodyText, "base64url")

  const decipher = createDecipheriv("aes-256-gcm", key, iv)
  decipher.setAuthTag(tag)

  return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8")
}
