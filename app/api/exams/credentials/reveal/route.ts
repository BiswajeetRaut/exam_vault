import { getAdminDb } from "@/lib/server/firebaseAdmin"
import { verifyBearerUid } from "@/lib/server/verifyRequestUser"
import { decryptSecret } from "@/lib/server/secureText"

export const runtime = "nodejs"

function json(data: unknown, status = 200) {
  return Response.json(data, { status })
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
    if (!exam.portalPasswordCipher) {
      return json({ error: "No saved password for this exam" }, 404)
    }

    const password = decryptSecret(String(exam.portalPasswordCipher))
    return json({ ok: true, password })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error"
    if (msg === "UNAUTHORIZED") return json({ error: "Unauthorized" }, 401)
    if (msg.includes("EXAM_SECRET_KEY")) {
      return json({ error: "Server misconfiguration: EXAM_SECRET_KEY" }, 503)
    }
    console.error("exam credentials reveal:", e)
    return json({ error: msg }, 500)
  }
}
