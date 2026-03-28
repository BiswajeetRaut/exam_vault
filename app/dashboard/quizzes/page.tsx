"use client"

import { useEffect, useMemo, useState } from "react"
import { auth, db } from "@/lib/firebase"
import { collection, getDocs, query, where } from "firebase/firestore"
import { useAuth } from "@/context/AuthContext"
import { useRouter } from "next/navigation"

type NoteRow = { id: string; title?: string; summary?: string; folderId?: string | null }
type FolderRow = { id: string; name?: string; parentId?: string | null }
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
  const [folders, setFolders] = useState<FolderRow[]>([])
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [title, setTitle] = useState("")
  const [questionCount, setQuestionCount] = useState(10)
  const [designNotes, setDesignNotes] = useState("")
  const [search, setSearch] = useState("")
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

      const folderQuery = query(collection(db, "note_folders"), where("userId", "==", user.uid))
      const folderSnap = await getDocs(folderQuery)
      const allFolders = folderSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as FolderRow[]
      setFolders(allFolders)
    }

    run()
  }, [user])

  useEffect(() => {
    if (!user) return

    const run = async () => {
      const historyQuery = query(collection(db, "quiz_history"), where("userId", "==", user.uid))
      const snap = await getDocs(historyQuery)
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[]
      rows.sort((a, b) => {
        const ta = Number(a.createdAt?.seconds || 0)
        const tb = Number(b.createdAt?.seconds || 0)
        return tb - ta
      })

      setHistory(
        rows.map((r) => ({
          id: r.id,
          quizId: String(r.quizId || ""),
          quizTitle: String(r.quizTitle || "Untitled quiz"),
          correct: Number(r.correct || 0),
          total: Number(r.total || 0),
          percentage: Number(r.percentage || 0),
        }))
      )
    }

    run()
  }, [user])

  const folderById = useMemo(
    () =>
      folders.reduce<Record<string, FolderRow>>((acc, f) => {
        acc[f.id] = f
        return acc
      }, {}),
    [folders]
  )

  const getFolderPath = (folderId?: string | null) => {
    if (!folderId) return "Root"
    const parts: string[] = []
    let current: string | null | undefined = folderId
    let guard = 0
    while (current && guard < 20) {
      const folder = folderById[current]
      if (!folder) break
      parts.unshift(folder.name || "Untitled folder")
      current = folder.parentId
      guard += 1
    }
    return parts.length ? parts.join(" / ") : "Root"
  }

  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return notes
    return notes.filter((note) => {
      const titleText = String(note.title || "").toLowerCase()
      const pathText = getFolderPath(note.folderId).toLowerCase()
      return titleText.includes(q) || pathText.includes(q)
    })
  }, [notes, search, folderById])

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
        <input
          className="input mt-2"
          placeholder="Search notes by title or folder path"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="mt-2 flex-col-stack-sm">
          {filteredNotes.length === 0 && <p className="text-sm">No notes with saved summaries yet.</p>}
          {filteredNotes.map((note) => (
            <label key={note.id} className="card card-pad-3" style={{ display: "block" }}>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={!!selected[note.id]}
                  onChange={(e) =>
                    setSelected((prev) => ({ ...prev, [note.id]: e.target.checked }))
                  }
                />
                <span className="font-medium">{note.title || "Untitled"}</span>
              </div>
              <p className="text-sm mt-1">Folder: {getFolderPath(note.folderId)}</p>
            </label>
          ))}
        </div>

        <p className="mt-4 text-sm">
          Selected notes: <strong>{selectedIds.length}</strong>
        </p>

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
