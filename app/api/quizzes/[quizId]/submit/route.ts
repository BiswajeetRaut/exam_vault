import { FieldValue } from "firebase-admin/firestore"
import { getAdminDb } from "@/lib/server/firebaseAdmin"
import { verifyBearerUid } from "@/lib/server/verifyRequestUser"

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
    const answers = Array.isArray(body?.answers)
      ? body.answers.map((x: unknown) => Number(x))
      : []

    const db = getAdminDb()
    const quizSnap = await db.collection("quizzes").doc(quizId).get()
    if (!quizSnap.exists) return json({ error: "Quiz not found" }, 404)

    const quiz = quizSnap.data()!
    if (quiz.userId !== uid) return json({ error: "Forbidden" }, 403)

    const questions = Array.isArray(quiz.questions) ? quiz.questions : []
    if (!questions.length) return json({ error: "Quiz has no questions" }, 422)

    const evaluation = questions.map((q: any, index: number) => {
      const userAnswer = Number.isInteger(answers[index]) ? answers[index] : -1
      const correctIndex = Number(q?.correctIndex)
      const isCorrect = userAnswer === correctIndex

      return {
        questionIndex: index,
        question: String(q?.question || ""),
        options: Array.isArray(q?.options) ? q.options : [],
        userAnswer,
        correctIndex,
        isCorrect,
        solution: String(q?.solution || "Reasoning unavailable."),
      }
    })

    const correct = evaluation.filter((x) => x.isCorrect).length
    const total = evaluation.length
    const percentage = total ? Math.round((correct / total) * 100) : 0

    const attemptRef = await db.collection("quiz_attempts").add({
      userId: uid,
      quizId,
      correct,
      total,
      percentage,
      answers,
      evaluation,
      createdAt: FieldValue.serverTimestamp(),
    })

    await db.collection("quiz_history").add({
      userId: uid,
      quizId,
      quizTitle: String(quiz.title || "Untitled quiz"),
      correct,
      total,
      percentage,
      attemptId: attemptRef.id,
      createdAt: FieldValue.serverTimestamp(),
    })

    return json({
      attemptId: attemptRef.id,
      score: { correct, total, percentage },
      evaluation,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error"
    if (msg === "UNAUTHORIZED") return json({ error: "Unauthorized" }, 401)
    console.error("quiz submit:", e)
    return json({ error: msg }, 500)
  }
}
