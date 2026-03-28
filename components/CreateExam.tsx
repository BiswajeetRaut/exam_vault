"use client"

import { useState } from "react"
import { auth, db } from "@/lib/firebase"
import { collection, addDoc } from "firebase/firestore"
import { useAuth } from "@/context/AuthContext"

export default function CreateExam({ refresh }: any) {

  const { user } = useAuth()
  const [name, setName] = useState("")
  const [searching, setSearching] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const createExam = async () => {
    if (!name || !user) return

    await addDoc(collection(db, "exams"), {
      userId: user.uid,
      name,
      normalizedName: name.toLowerCase(),
      status: "interested",
      createdAt: new Date()
    })

    setName("")
    setSuggestions([])
    refresh()
  }

  const searchExamSuggestions = async () => {
    setError(null)
    setSearching(true)
    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) throw new Error("Not signed in")

      const res = await fetch(`/api/exams/search?q=${encodeURIComponent(name.trim())}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Could not fetch suggestions")

      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="card card-pad-4 flex-col-stack-sm">

      <input
        type="text"
        placeholder="Exam name (UPSC 2026)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="input"
      />

      <div className="flex flex-gap-md">
        <button type="button" onClick={createExam} className="btn btn-primary">
          Add Exam
        </button>
        <button
          type="button"
          onClick={searchExamSuggestions}
          className="btn"
          disabled={!name.trim() || searching}
        >
          {searching ? "Searching..." : "Find matching exams"}
        </button>
      </div>

      {error && <p className="notes-error">{error}</p>}

      {suggestions.length > 0 && (
        <div className="flex-col-stack-sm">
          <p className="text-sm">Select suggested exam:</p>
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="btn"
              onClick={() => setName(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

    </div>
  )
}
