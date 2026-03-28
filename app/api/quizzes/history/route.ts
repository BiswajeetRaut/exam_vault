import { getAdminDb } from "@/lib/server/firebaseAdmin"
import { verifyBearerUid } from "@/lib/server/verifyRequestUser"

export const runtime = "nodejs"

function json(data: unknown, status = 200) {
  return Response.json(data, { status })
}

export async function GET(request: Request) {
  try {
    const uid = await verifyBearerUid(request)
    const db = getAdminDb()

    const attemptsSnap = await db
      .collection("quiz_history")
      .where("userId", "==", uid)
      .orderBy("createdAt", "desc")
      .limit(50)
      .get()

    const attempts = await Promise.all(
      attemptsSnap.docs.map(async (doc) => {
        const data = doc.data() as any
        return {
          id: doc.id,
          quizId: data.quizId,
          quizTitle: data.quizTitle || "Untitled quiz",
          correct: data.correct,
          total: data.total,
          percentage: data.percentage,
          createdAt: data.createdAt || null,
        }
      })
    )

    return json({ attempts })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error"
    if (msg === "UNAUTHORIZED") return json({ error: "Unauthorized" }, 401)
    console.error("quiz history:", e)
    return json({ error: msg }, 500)
  }
}
