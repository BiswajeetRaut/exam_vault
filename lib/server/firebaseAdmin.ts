import { cert, getApps, initializeApp, type App } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"
import { getFirestore } from "firebase-admin/firestore"

function normalizePrivateKey(raw: string | undefined) {
  if (!raw) return null

  const trimmed = raw.trim()
  const withoutWrappingQuotes =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ? trimmed.slice(1, -1)
      : trimmed

  const restoredNewlines = withoutWrappingQuotes.replace(/\\n/g, "\n")

  if (restoredNewlines.includes("BEGIN PRIVATE KEY")) {
    return restoredNewlines
  }

  try {
    const decoded = Buffer.from(restoredNewlines, "base64").toString("utf8").trim()
    if (decoded.includes("BEGIN PRIVATE KEY")) {
      return decoded
    }
  } catch {
    // ignore and return null below
  }

  return null
}

function initAdmin(): App {
  const existing = getApps()[0]
  if (existing) return existing

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY)

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY (raw PEM with \\n or base64-encoded PEM)."
    )
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  })
}

export function getAdminAuth() {
  initAdmin()
  return getAuth()
}

export function getAdminDb() {
  initAdmin()
  return getFirestore()
}
