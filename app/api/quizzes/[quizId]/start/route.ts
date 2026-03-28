import { getAdminDb } from "@/lib/server/firebaseAdmin"
import { verifyBearerUid } from "@/lib/server/verifyRequestUser"

export const runtime = "nodejs"

function json(data: unknown, status = 200) {
  return Response.json(data, { status })
}

export async function GET(
  request: Request,
  context: { params: Promise<{ quizId: string }> }
) {
  try {
    const uid = await verifyBearerUid(request)
    const { quizId } = await context.params

    const db = getAdminDb()
    const snap = await db.collection("quizzes").doc(quizId).get()
    if (!snap.exists) return json({ error: "Quiz not found" }, 404)

    const quiz = snap.data()!
    if (quiz.userId !== uid) return json({ error: "Forbidden" }, 403)

    const safeQuestions = Array.isArray(quiz.questions)
      ? quiz.questions.map((q: any, index: number) => ({
          id: index,
          question: q.question,
          options: q.options,
        }))
      : []

    return json({
      quiz: {
        id: snap.id,
        title: quiz.title,
        questionCount: quiz.questionCount,
        designNotes: quiz.designNotes || "",
      },
      questions: safeQuestions,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error"
    if (msg === "UNAUTHORIZED") return json({ error: "Unauthorized" }, 401)
    console.error("quiz start:", e)
    return json({ error: msg }, 500)
  }
}
