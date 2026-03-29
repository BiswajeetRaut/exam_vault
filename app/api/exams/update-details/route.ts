import { FieldValue } from "firebase-admin/firestore"
import { getAdminDb } from "@/lib/server/firebaseAdmin"
import { verifyBearerUid } from "@/lib/server/verifyRequestUser"
import { encryptSecret, hashSecret } from "@/lib/server/secureText"

export const runtime = "nodejs"

function json(data: unknown, status = 200) {
  return Response.json(data, { status })
}

function parseDateInput(value: unknown) {
  const text = typeof value === "string" ? value.trim() : ""
  if (!text) return null
  const parsed = new Date(`${text}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

export async function POST(request: Request) {
  try {
    const uid = await verifyBearerUid(request)
    const body = await request.json().catch(() => null)

    const examId = typeof body?.examId === "string" ? body.examId : null
    if (!examId) return json({ error: "examId is required" }, 400)

    const db = getAdminDb()
    const examRef = db.collection("exams").doc(examId)
    const examSnap = await examRef.get()
    if (!examSnap.exists) return json({ error: "Exam not found" }, 404)

    const exam = examSnap.data() as any
    if (exam.userId !== uid) return json({ error: "Forbidden" }, 403)

    const updates: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    }

    if (typeof body?.applicationNumber === "string") {
      updates.applicationNumber = body.applicationNumber.trim().slice(0, 120)
    }
    if (typeof body?.registrationNumber === "string") {
      updates.registrationNumber = body.registrationNumber.trim().slice(0, 120)
    }

    if ("examDate" in (body || {})) {
      const parsedDate = parseDateInput(body?.examDate)
      if (!parsedDate && body?.examDate) {
        return json({ error: "examDate must be in YYYY-MM-DD format" }, 400)
      }
      updates.examDate = parsedDate || FieldValue.delete()
      if (parsedDate) updates.status = "exam_date_known"
    }

    if (typeof body?.portalPassword === "string") {
      const secret = body.portalPassword.trim()
      if (!secret) {
        updates.portalPasswordHash = FieldValue.delete()
        updates.portalPasswordCipher = FieldValue.delete()
      } else {
        updates.portalPasswordHash = hashSecret(secret)
        updates.portalPasswordCipher = encryptSecret(secret)
        updates.portalPasswordUpdatedAt = FieldValue.serverTimestamp()
      }
    }

    await examRef.set(updates, { merge: true })

    return json({ ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error"
    if (msg === "UNAUTHORIZED") return json({ error: "Unauthorized" }, 401)
    if (msg.includes("EXAM_SECRET_KEY")) {
      return json({ error: "Server misconfiguration: EXAM_SECRET_KEY" }, 503)
    }
    console.error("exam update-details:", e)
    return json({ error: msg }, 500)
  }
}
