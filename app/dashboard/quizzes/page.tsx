"use client"

import { useEffect, useMemo, useState } from "react"
import { auth, db } from "@/lib/firebase"
import { collection, getDocs, query, where } from "firebase/firestore"
import { useAuth } from "@/context/AuthContext"
import { useRouter } from "next/navigation"

type NoteRow = { id: string; title?: string; summary?: string }
type AttemptRow = {
  id: string
  quizId: string
  quizTitle: string
  correct: number
  total: number
  percentage: number
}

export default function QuizzesPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const [notes, setNotes] = useState<NoteRow[]>([])
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [title, setTitle] = useState("")
  const [questionCount, setQuestionCount] = useState(10)
  const [designNotes, setDesignNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [history, setHistory] = useState<AttemptRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => k),
    [selected]
  )

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
    }
  }, [loading, user, router])

  useEffect(() => {
    if (!user) return

    const run = async () => {
      const q = query(collection(db, "notes"), where("userId", "==", user.uid))
      const snap = await getDocs(q)
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as NoteRow[]
      setNotes(all.filter((n) => typeof n.summary === "string" && n.summary.trim()))
    }

    run()
  }, [user])

  useEffect(() => {
    if (!user) return

    const run = async () => {
      const token = await auth.currentUser?.getIdToken()
      if (!token) return

      const res = await fetch("/api/quizzes/history", {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return
      setHistory(Array.isArray(data.attempts) ? data.attempts : [])
    }

    run()
  }, [user])

  const createQuiz = async () => {
    setError(null)
    setSubmitting(true)

    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) throw new Error("Not signed in")

      const res = await fetch("/api/quizzes/create", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          selectedNoteIds: selectedIds,
          questionCount,
          designNotes,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Failed to create quiz")
      }

      router.push(`/dashboard/quizzes/${data.quizId}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="page-wide"><p className="loading-line">Loading…</p></div>
  }

  return (
    <div className="page-wide">
      <h1 className="page-title">Quizzes</h1>

      <div className="card card-pad-4">
        <h2 className="section-title">Create Quiz</h2>

        <input
          className="input mt-4"
          placeholder="Quiz title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <p className="mt-4 font-medium">Select notes</p>
        <div className="mt-2 flex-col-stack-sm">
          {notes.length === 0 && <p className="text-sm">No notes with saved summaries yet.</p>}
          {notes.map((note) => (
            <label key={note.id} className="card card-pad-3" style={{ display: "flex", gap: 8 }}>
              <input
                type="checkbox"
                checked={!!selected[note.id]}
                onChange={(e) =>
                  setSelected((prev) => ({ ...prev, [note.id]: e.target.checked }))
                }
              />
              <span>{note.title || "Untitled"}</span>
            </label>
          ))}
        </div>

        <p className="mt-4 font-medium">Question count</p>
        <div className="flex flex-gap-sm mt-2">
          {[10, 30, 60].map((n) => (
            <button
              type="button"
              key={n}
              onClick={() => setQuestionCount(n)}
              className={`btn ${questionCount === n ? "btn-primary" : ""}`}
            >
              {n} Questions
            </button>
          ))}
        </div>

        <p className="mt-4 font-medium">Quiz design notes</p>
        <textarea
          className="textarea-notes"
          value={designNotes}
          onChange={(e) => setDesignNotes(e.target.value)}
          placeholder="Example: focus more on conceptual and tricky questions, less memorization."
        />

        {error && <p className="notes-error">{error}</p>}

        <div className="mt-4">
          <button
            type="button"
            className="btn btn-primary"
            onClick={createQuiz}
            disabled={submitting || !title.trim() || selectedIds.length === 0}
          >
            {submitting ? "Creating quiz…" : "Create Quiz"}
          </button>
        </div>
      </div>

      <div className="card card-pad-4 mt-6">
        <h2 className="section-title">Quiz History</h2>
        <div className="mt-4 flex-col-stack-sm">
          {history.length === 0 && <p className="text-sm">No quiz attempts yet.</p>}
          {history.map((h) => (
            <div key={h.id} className="card card-pad-3">
              <p className="font-medium">{h.quizTitle}</p>
              <p className="text-sm mt-1">Score: {h.correct}/{h.total} ({h.percentage}%)</p>
              <button
                type="button"
                className="btn mt-3"
                onClick={() => router.push(`/dashboard/quizzes/${h.quizId}`)}
              >
                Open Quiz
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
