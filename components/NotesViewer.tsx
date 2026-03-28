"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { auth, db } from "@/lib/firebase"
import { collection, query, where, getDocs } from "firebase/firestore"
import { deleteDoc, doc, getDoc } from "firebase/firestore"
import { getAccessToken } from "@/lib/googleGIS"
import { deleteFromDrive } from "@/lib/deleteFromDrive"
import { useAuth } from "@/context/AuthContext"
import { getYoutubeEmbedUrl } from "@/lib/youtubeVideoId"

type ItemRow = { id: string; type?: string; content?: any }

export default function NotesViewer({ note }: { note: { id: string; title?: string } }) {
  const { user } = useAuth()
  const [items, setItems] = useState<ItemRow[]>([])
  const [summary, setSummary] = useState("")
  const [savedSummary, setSavedSummary] = useState("")
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [indexing, setIndexing] = useState(false)
  const [indexingItemId, setIndexingItemId] = useState<string | null>(null)
  const [indexInfo, setIndexInfo] = useState<string>("")
  const [error, setError] = useState<string | null>(null)

  const hasYoutube = useMemo(
    () => items.some((i) => i.type === "youtube" && i.content),
    [items]
  )

  const dirty = summary !== savedSummary

  useEffect(() => {
    let cancelled = false

    const loadNoteSummary = async () => {
      const snap = await getDoc(doc(db, "notes", note.id))
      if (cancelled || !snap.exists()) return
      const data = snap.data()
      const text = typeof data?.summary === "string" ? data.summary : ""
      const ragChunkCount = typeof data?.ragChunkCount === "number" ? data.ragChunkCount : 0
      setSummary(text)
      setSavedSummary(text)
      setIndexInfo(ragChunkCount > 0 ? `Indexed (${ragChunkCount} chunks)` : "")
    }

    loadNoteSummary()
    return () => {
      cancelled = true
    }
  }, [note.id])

  useEffect(() => {
    let cancelled = false

    const fetchItems = async () => {
      const q = query(collection(db, "note_items"), where("noteId", "==", note.id))
      const snapshot = await getDocs(q)
      if (cancelled) return
      setItems(
        snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as ItemRow[]
      )
    }

    fetchItems()
    return () => {
      cancelled = true
    }
  }, [note.id])

  const authHeader = useCallback(async () => {
    const u = auth.currentUser
    if (!u) throw new Error("Not signed in")
    const token = await u.getIdToken()
    return { Authorization: `Bearer ${token}` }
  }, [])

  const generateSummary = async () => {
    setError(null)
    setGenerating(true)
    try {
      const headers = await authHeader()
      const res = await fetch("/api/notes/summarize", {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ noteId: note.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Summary failed")
      }
      if (typeof data.summary !== "string") {
        throw new Error("Invalid response")
      }
      setSummary(data.summary)
      setSavedSummary(data.summary)
      setIndexInfo("")
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      setGenerating(false)
    }
  }

  const saveSummary = async () => {
    setError(null)
    setSaving(true)
    try {
      const headers = await authHeader()
      const res = await fetch("/api/notes/summary", {
        method: "PATCH",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ noteId: note.id, summary }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Save failed")
      }
      setSavedSummary(summary)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      setSaving(false)
    }
  }

  const indexToRag = async () => {
    setError(null)
    setIndexing(true)
    try {
      const headers = await authHeader()
      const res = await fetch("/api/notes/rag/index", {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ noteId: note.id }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "RAG indexing failed")
      }

      const chunkCount = typeof data.chunks === "number" ? data.chunks : 0
      setIndexInfo(`Indexed (${chunkCount} chunks)`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      setIndexing(false)
    }
  }

  const indexDriveItemToRag = async (itemId: string) => {
    setError(null)
    setIndexingItemId(itemId)
    try {
      const headers = await authHeader()
      const driveAccessToken = await getAccessToken()

      const res = await fetch("/api/notes/rag/index-drive", {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          noteId: note.id,
          noteItemId: itemId,
          driveAccessToken,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Drive RAG indexing failed")
      }

      const chunkCount = typeof data.chunks === "number" ? data.chunks : 0
      setIndexInfo(`${data.fileName || "File"} indexed (${chunkCount} chunks)`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      setIndexingItemId(null)
    }
  }

  return (
    <div className="mt-6">
      <h1 className="title">{note.title}</h1>

      {items.map((item) => {
        if (item.type === "youtube") {
          const embed = getYoutubeEmbedUrl(String(item.content || ""))
          if (!embed) return null
          return (
            <iframe
              key={item.id}
              className="video"
              src={embed}
              title="YouTube"
              allowFullScreen
            />
          )
        }

        if (item.type === "drive") {
          return (
            <div key={item.id} className="card card-pad-4 mt-4">
              <p className="font-medium">{item.content?.name}</p>
              <div className="flex-between mt-4">
                <a
                  href={item.content?.url}
                  target="_blank"
                  rel="noreferrer"
                  className="link-accent text-sm"
                >
                  Open
                </a>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={async () => {
                    try {
                      const token = await getAccessToken()
                      await deleteFromDrive(item.content.id, token)
                      await deleteDoc(doc(db, "note_items", item.id))
                      alert("Deleted")
                      location.reload()
                    } catch (err) {
                      console.error(err)
                      alert("Delete failed")
                    }
                  }}
                >
                  Delete
                </button>
              </div>
              <div className="mt-3">
                <button
                  type="button"
                  className="btn"
                  onClick={() => indexDriveItemToRag(item.id)}
                  disabled={!user || indexingItemId === item.id}
                >
                  {indexingItemId === item.id ? "Indexing file…" : "Store file to RAG"}
                </button>
              </div>
            </div>
          )
        }

        if (item.type === "link") {
          return (
            <a
              key={item.id}
              href={item.content}
              target="_blank"
              rel="noreferrer"
              className="link-accent text-sm mt-4"
              style={{ display: "inline-block" }}
            >
              {item.content}
            </a>
          )
        }

        return null
      })}

      <div className="card card-pad-4 mt-6">
        <h2 className="section-title mb-4">Study notes</h2>

        {!user && <p className="notes-hint">Sign in to generate and save AI notes.</p>}

        {user && !hasYoutube && (
          <p className="notes-hint">
            Add a YouTube link to this note (when creating it) to generate structured notes from
            captions. You can still type or paste notes below and save them.
          </p>
        )}

        {error && <p className="notes-error">{error}</p>}

        <textarea
          className="textarea-notes"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="AI-generated notes appear here. Edit freely, then save."
          disabled={!user}
          spellCheck
        />

        <div className="notes-actions">
          {hasYoutube && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={generateSummary}
              disabled={!user || generating}
            >
              {generating ? "Generating…" : "Generate from YouTube"}
            </button>
          )}
          <button type="button" className="btn" onClick={saveSummary} disabled={!user || saving || !dirty}>
            {saving ? "Saving…" : "Save notes"}
          </button>
          <button
            type="button"
            className="btn"
            onClick={indexToRag}
            disabled={!user || indexing || !savedSummary.trim() || dirty}
          >
            {indexing ? "Indexing…" : "Store to RAG"}
          </button>
          {dirty && user && <span className="text-sm">Unsaved changes</span>}
          {!dirty && indexInfo && <span className="text-sm">{indexInfo}</span>}
        </div>
      </div>
    </div>
  )
}
