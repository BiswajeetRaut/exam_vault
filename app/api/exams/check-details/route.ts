import { FieldValue } from "firebase-admin/firestore"
import { getAdminDb } from "@/lib/server/firebaseAdmin"
import { verifyBearerUid } from "@/lib/server/verifyRequestUser"
import { fetchExamDatesFromSerp } from "@/lib/server/examIntelligence"

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

    const searchQuery = `${exam.name || "exam"} exam date latest official notification`
    const result = await fetchExamDatesFromSerp(searchQuery)

    const updates: Record<string, unknown> = {
      detailsCheckedAt: FieldValue.serverTimestamp(),
      serpSnippets: result.snippets.slice(0, 5),
      serpConfidence: result.confidence,
      serpReasoning: result.reasoning,
      updatedAt: FieldValue.serverTimestamp(),
    }

    if (result.detectedDate) {
      const date = new Date(result.detectedDate)
      if (!Number.isNaN(date.getTime())) {
        updates.examDate = date
        updates.status = "exam_date_known"
      }
    }

    await examRef.set(updates, { merge: true })

    await db.collection("exam_events").add({
      userId: uid,
      examId,
      eventType: "serp_date_found",
      payload: {
        detectedDate: result.detectedDate,
        confidence: result.confidence,
        reasoning: result.reasoning,
        snippets: result.snippets.slice(0, 5),
      },
      createdAt: FieldValue.serverTimestamp(),
    })

    return json({
      ok: true,
      detectedDate: result.detectedDate,
      confidence: result.confidence,
      reasoning: result.reasoning,
      snippets: result.snippets.slice(0, 5),
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error"
    if (msg === "UNAUTHORIZED") return json({ error: "Unauthorized" }, 401)
    if (msg.includes("SERPAPI_KEY")) {
      return json({ error: "Server misconfiguration: SERPAPI_KEY" }, 503)
    }
    console.error("exam check-details:", e)
    return json({ error: msg }, 500)
  }
}
