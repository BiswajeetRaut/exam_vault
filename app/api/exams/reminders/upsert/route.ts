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
    const allowedDays = new Set([1, 3, 7, 14])
    const daysBefore = allowedDays.has(Number(body?.daysBefore)) ? Number(body.daysBefore) : 7
    if (!examId) return json({ error: "examId is required" }, 400)

    const db = getAdminDb()
    const examRef = db.collection("exams").doc(examId)
    const examSnap = await examRef.get()
    if (!examSnap.exists) return json({ error: "Exam not found" }, 404)

    const exam = examSnap.data() as any
    if (exam.userId !== uid) return json({ error: "Forbidden" }, 403)

    const examDate: Date | null = exam.examDate?.toDate ? exam.examDate.toDate() : null
    if (!examDate || Number.isNaN(examDate.getTime())) {
      return json({ error: "Exam date is not available yet" }, 400)
    }

    const remindAt = new Date(examDate)
    remindAt.setDate(remindAt.getDate() - daysBefore)
    const now = new Date()
    if (remindAt < now) remindAt.setTime(now.getTime() + 60 * 1000)

    const reminderId = `${uid}_${examId}_${daysBefore}_days_before`
    await db.collection("exam_reminders").doc(reminderId).set(
      {
        userId: uid,
        examId,
        examName: exam.name || "Exam",
        type: "days_before",
        daysBefore,
        channel: "email",
        enabled: true,
        status: "scheduled",
        remindAt,
        examDate,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    )

    return json({ ok: true, remindAt, daysBefore })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error"
    if (msg === "UNAUTHORIZED") return json({ error: "Unauthorized" }, 401)
    console.error("exam reminder upsert:", e)
    return json({ error: msg }, 500)
  }
}
