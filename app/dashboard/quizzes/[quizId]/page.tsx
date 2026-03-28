"use client"

import { useEffect, useMemo, useState } from "react"
import { auth } from "@/lib/firebase"
import { useParams, useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"

type Question = { id: number; question: string; options: string[] }
type EvalRow = {
  questionIndex: number
  question: string
  options: string[]
  userAnswer: number
  correctIndex: number
  isCorrect: boolean
  solution: string
}

export default function QuizAttemptPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const params = useParams<{ quizId: string }>()
  const quizId = params.quizId

  const [title, setTitle] = useState("")
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<number[]>([])
  const [evaluation, setEvaluation] = useState<EvalRow[] | null>(null)
  const [score, setScore] = useState<{ correct: number; total: number; percentage: number } | null>(null)
  const [loadingQuiz, setLoadingQuiz] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [chatText, setChatText] = useState<Record<number, string>>({})
  const [chatAnswer, setChatAnswer] = useState<Record<number, string>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !user) router.push("/login")
  }, [loading, user, router])

  useEffect(() => {
    if (!user || !quizId) return

    const run = async () => {
      setLoadingQuiz(true)
      setError(null)
      try {
        const token = await auth.currentUser?.getIdToken()
        if (!token) throw new Error("Not signed in")

        const res = await fetch(`/api/quizzes/${quizId}/start`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || "Failed to load quiz")

        setTitle(data?.quiz?.title || "Quiz")
        const list = Array.isArray(data?.questions) ? data.questions : []
        setQuestions(list)
        setAnswers(new Array(list.length).fill(-1))
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Something went wrong")
      } finally {
        setLoadingQuiz(false)
      }
    }

    run()
  }, [user, quizId])

  const answeredCount = useMemo(() => answers.filter((x) => x >= 0).length, [answers])

  const submitQuiz = async () => {
    if (!quizId) return

    setError(null)
    setSubmitting(true)

    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) throw new Error("Not signed in")

      const res = await fetch(`/api/quizzes/${quizId}/submit`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ answers }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Submit failed")

      setEvaluation(Array.isArray(data.evaluation) ? data.evaluation : [])
      setScore(data.score || null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      setSubmitting(false)
    }
  }

  const askBot = async (row: EvalRow) => {
    const query = (chatText[row.questionIndex] || "").trim()
    if (!query) return

    setError(null)
    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) throw new Error("Not signed in")

      const res = await fetch(`/api/quizzes/${quizId}/question-chat`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          questionIndex: row.questionIndex,
          query,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Bot failed")

      setChatAnswer((prev) => ({ ...prev, [row.questionIndex]: String(data.answer || "") }))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong")
    }
  }

  if (loading || loadingQuiz) {
    return <div className="page-wide"><p className="loading-line">Loading…</p></div>
  }

  return (
    <div className="page-wide">
      <h1 className="page-title">{title}</h1>

      {error && <p className="notes-error">{error}</p>}

      {!evaluation && (
        <div className="card card-pad-4">
          <p className="text-sm">Answered: {answeredCount}/{questions.length}</p>

          <div className="mt-4 flex-col-stack">
            {questions.map((q, idx) => (
              <div key={q.id} className="card card-pad-4">
                <p className="font-medium">Q{idx + 1}. {q.question}</p>
                <div className="mt-3 flex-col-stack-sm">
                  {q.options.map((opt, optIdx) => (
                    <label key={optIdx} style={{ display: "flex", gap: 8 }}>
                      <input
                        type="radio"
                        name={`q-${q.id}`}
                        checked={answers[idx] === optIdx}
                        onChange={() =>
                          setAnswers((prev) => {
                            const next = [...prev]
                            next[idx] = optIdx
                            return next
                          })
                        }
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <button type="button" className="btn btn-primary" onClick={submitQuiz} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit Quiz"}
            </button>
          </div>
        </div>
      )}

      {evaluation && (
        <div className="card card-pad-4">
          <h2 className="section-title">Results</h2>
          {score && (
            <p className="mt-2 font-medium">Score: {score.correct}/{score.total} ({score.percentage}%)</p>
          )}

          <div className="mt-4 flex-col-stack">
            {evaluation.map((row) => (
              <div key={row.questionIndex} className="card card-pad-4">
                <p className="font-medium">Q{row.questionIndex + 1}. {row.question}</p>
                <p className="text-sm mt-2">Your answer: {row.userAnswer >= 0 ? row.options[row.userAnswer] : "Not answered"}</p>
                <p className="text-sm">Correct answer: {row.options[row.correctIndex]}</p>
                <p className="text-sm mt-2">Reasoning: {row.solution}</p>

                <textarea
                  className="textarea-notes mt-4"
                  placeholder="Ask bot about this question"
                  value={chatText[row.questionIndex] || ""}
                  onChange={(e) =>
                    setChatText((prev) => ({
                      ...prev,
                      [row.questionIndex]: e.target.value,
                    }))
                  }
                />
                <button type="button" className="btn" onClick={() => askBot(row)}>
                  Ask Bot
                </button>
                {chatAnswer[row.questionIndex] && (
                  <p className="text-sm mt-3">Bot: {chatAnswer[row.questionIndex]}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
