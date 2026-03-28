import { FieldValue } from "firebase-admin/firestore"
import { getAdminDb } from "@/lib/server/firebaseAdmin"
import { verifyBearerUid } from "@/lib/server/verifyRequestUser"
import { generateQuizFromNotes } from "@/lib/server/groqQuiz"

export const runtime = "nodejs"

function json(data: unknown, status = 200) {
  return Response.json(data, { status })
}

const ALLOWED_COUNTS = new Set([10, 30, 60])

export async function POST(request: Request) {
  try {
    const uid = await verifyBearerUid(request)
    const body = await request.json().catch(() => null)

    const title = typeof body?.title === "string" ? body.title.trim() : ""
    const selectedNoteIds = Array.isArray(body?.selectedNoteIds)
      ? body.selectedNoteIds.filter((x: unknown) => typeof x === "string")
      : []
    const questionCount = Number(body?.questionCount)
    const designNotes = typeof body?.designNotes === "string" ? body.designNotes.trim() : ""

    if (!title) return json({ error: "Quiz title is required" }, 400)
    if (!selectedNoteIds.length) return json({ error: "Select at least one note" }, 400)
    if (!ALLOWED_COUNTS.has(questionCount)) {
      return json({ error: "questionCount must be 10, 30, or 60" }, 400)
    }

    const db = getAdminDb()

    const noteDocs = await Promise.all(
      selectedNoteIds.map((noteId: string) => db.collection("notes").doc(noteId).get())
    )

    const noteSummaries = noteDocs
      .map((snap) => ({ id: snap.id, ...snap.data() }))
      .filter((n: any) => n.userId === uid && typeof n.summary === "string" && n.summary.trim())
      .map((n: any) => ({
        title: typeof n.title === "string" ? n.title : "Untitled",
        summary: n.summary,
      }))

    if (!noteSummaries.length) {
      return json({ error: "No selected notes have generated/saved summaries" }, 400)
    }

    const questions = await generateQuizFromNotes({
      questionCount,
      designNotes,
      noteSummaries,
    })

    const quizRef = await db.collection("quizzes").add({
      userId: uid,
      title,
      selectedNoteIds,
      questionCount,
      designNotes,
      questions,
      createdAt: FieldValue.serverTimestamp(),
    })

    return json({ ok: true, quizId: quizRef.id })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error"
    if (msg === "UNAUTHORIZED") return json({ error: "Unauthorized" }, 401)
    if (msg.includes("GROQ_API_KEY")) {
      return json({ error: "Server misconfiguration: GROQ_API_KEY" }, 503)
    }
    console.error("quiz create:", e)
    return json({ error: msg }, 500)
  }
}
