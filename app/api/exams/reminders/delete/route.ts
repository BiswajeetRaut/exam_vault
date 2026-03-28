import { FieldValue } from "firebase-admin/firestore"
import { getAdminDb } from "@/lib/server/firebaseAdmin"
import { verifyBearerUid } from "@/lib/server/verifyRequestUser"

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
    const reminderId = `${uid}_${examId}_one_week_before`

    await db.collection("exam_reminders").doc(reminderId).set(
      {
        enabled: false,
        status: "cancelled",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    )

    return json({ ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error"
    if (msg === "UNAUTHORIZED") return json({ error: "Unauthorized" }, 401)
    console.error("exam reminder delete:", e)
    return json({ error: msg }, 500)
  }
}
