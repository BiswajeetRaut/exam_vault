"use client"

import { useEffect, useMemo, useState } from "react"
import { auth } from "@/lib/firebase"

function toDateInput(value: any) {
  const date = value?.toDate ? value.toDate() : value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return ""
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export default function ExamDetailsForm({ exam, onSaved }: any) {
  const [examDate, setExamDate] = useState("")
  const [applicationNumber, setApplicationNumber] = useState("")
  const [registrationNumber, setRegistrationNumber] = useState("")
  const [portalPassword, setPortalPassword] = useState("")
  const [revealedPassword, setRevealedPassword] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    setExamDate(toDateInput(exam?.examDate))
    setApplicationNumber(String(exam?.applicationNumber || ""))
    setRegistrationNumber(String(exam?.registrationNumber || ""))
    setPortalPassword("")
    setRevealedPassword("")
    setError(null)
    setMessage(null)
  }, [exam?.id])

  const hasSavedPassword = useMemo(
    () => Boolean(exam?.portalPasswordCipher || exam?.portalPasswordHash),
    [exam?.portalPasswordCipher, exam?.portalPasswordHash]
  )

  const authedPost = async (url: string, body: Record<string, unknown>) => {
    const token = await auth.currentUser?.getIdToken()
    if (!token) throw new Error("Not signed in")

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || "Request failed")
    return data
  }

  const saveDetails = async () => {
    setSaving(true)
    setError(null)
    setMessage(null)

    try {
      await authedPost("/api/exams/update-details", {
        examId: exam.id,
        examDate: examDate || null,
        applicationNumber,
        registrationNumber,
        portalPassword,
      })
      setPortalPassword("")
      setMessage("Details saved")
      onSaved?.({
        examDate: examDate || null,
        applicationNumber,
        registrationNumber,
        hasPassword: Boolean(portalPassword) || hasSavedPassword,
      })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not save details")
    } finally {
      setSaving(false)
    }
  }

  const revealPassword = async () => {
    setError(null)
    try {
      const data = await authedPost("/api/exams/credentials/reveal", { examId: exam.id })
      setRevealedPassword(String(data.password || ""))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not reveal password")
    }
  }

  const copyRevealed = async () => {
    if (!revealedPassword) return
    await navigator.clipboard.writeText(revealedPassword).catch(() => null)
    setMessage("Password copied")
  }

  return (
    <div className="card card-pad-4 flex-col-stack-sm">
      <h3 className="section-title">Exam details & credentials</h3>
      <p className="text-xs">
        Save exam date manually and optional login credentials for quick access.
      </p>
      <input
        type="date"
        className="input"
        value={examDate}
        onChange={(e) => setExamDate(e.target.value)}
      />
      <input
        type="text"
        className="input"
        placeholder="Application number"
        value={applicationNumber}
        onChange={(e) => setApplicationNumber(e.target.value)}
      />
      <input
        type="text"
        className="input"
        placeholder="Registration number"
        value={registrationNumber}
        onChange={(e) => setRegistrationNumber(e.target.value)}
      />
      <input
        type="password"
        className="input"
        placeholder="Portal password (leave blank to keep unchanged)"
        value={portalPassword}
        onChange={(e) => setPortalPassword(e.target.value)}
      />
      <div className="flex flex-gap-sm">
        <button type="button" className="btn btn-primary" onClick={saveDetails} disabled={saving}>
          {saving ? "Saving..." : "Save details"}
        </button>
        <button type="button" className="btn" onClick={revealPassword} disabled={!hasSavedPassword}>
          Reveal saved password
        </button>
        <button type="button" className="btn" onClick={copyRevealed} disabled={!revealedPassword}>
          Copy password
        </button>
      </div>
      {revealedPassword && <p className="text-sm">Password: {revealedPassword}</p>}
      {message && <p className="text-sm">{message}</p>}
      {error && <p className="notes-error">{error}</p>}
    </div>
  )
}
