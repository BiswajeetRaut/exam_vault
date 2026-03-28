import { FieldValue } from "firebase-admin/firestore"
import { getAdminDb } from "@/lib/server/firebaseAdmin"
import { verifyBearerUid } from "@/lib/server/verifyRequestUser"
import { answerQuestionBounded } from "@/lib/server/groqQuiz"

export const runtime = "nodejs"

function json(data: unknown, status = 200) {
  return Response.json(data, { status })
}

export async function POST(
  request: Request,
  context: { params: Promise<{ quizId: string }> }
) {
  try {
    const uid = await verifyBearerUid(request)
    const { quizId } = await context.params

    const body = await request.json().catch(() => null)
    const questionIndex = Number(body?.questionIndex)
    const userQuery = typeof body?.query === "string" ? body.query.trim() : ""

    if (!Number.isInteger(questionIndex) || questionIndex < 0) {
      return json({ error: "questionIndex is required" }, 400)
    }
    if (!userQuery) return json({ error: "query is required" }, 400)

    const db = getAdminDb()
    const quizSnap = await db.collection("quizzes").doc(quizId).get()
    if (!quizSnap.exists) return json({ error: "Quiz not found" }, 404)

    const quiz = quizSnap.data()!
    if (quiz.userId !== uid) return json({ error: "Forbidden" }, 403)

    const questions = Array.isArray(quiz.questions) ? quiz.questions : []
    const q = questions[questionIndex]
    if (!q) return json({ error: "Question not found" }, 404)

    const answer = await answerQuestionBounded({
      question: String(q?.question || ""),
      options: Array.isArray(q?.options) ? q.options.map((x: unknown) => String(x)) : [],
      correctIndex: Number(q?.correctIndex),
      solution: String(q?.solution || ""),
      userQuery,
    })

    await db.collection("quiz_question_chats").add({
      userId: uid,
      quizId,
      questionIndex,
      query: userQuery,
      answer,
      createdAt: FieldValue.serverTimestamp(),
    })

    return json({ answer })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error"
    if (msg === "UNAUTHORIZED") return json({ error: "Unauthorized" }, 401)
    if (msg.includes("GROQ_API_KEY")) {
      return json({ error: "Server misconfiguration: GROQ_API_KEY" }, 503)
    }
    console.error("question chat:", e)
    return json({ error: msg }, 500)
  }
}
