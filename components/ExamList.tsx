"use client"

import { useEffect, useState } from "react"
import { auth, db } from "@/lib/firebase"
import { collection, query, where, getDocs } from "firebase/firestore"
import { useAuth } from "@/context/AuthContext"

export default function ExamList({ onSelect, refreshTrigger }: any) {

  const { user } = useAuth()
  const [exams, setExams] = useState<any[]>([])
  const [reminders, setReminders] = useState<
    Record<string, { enabled: boolean; daysBefore?: number; remindAt?: any }>
  >({})
  const [daysConfig, setDaysConfig] = useState<Record<string, number>>({})
  const [workingExamId, setWorkingExamId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchExams = async () => {
    if (!user) return

    const q = query(
      collection(db, "exams"),
      where("userId", "==", user.uid)
    )

    const snapshot = await getDocs(q)

    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))

    setExams(data)

    const remindersQuery = query(
      collection(db, "exam_reminders"),
      where("userId", "==", user.uid),
      where("enabled", "==", true)
    )
    const remindersSnap = await getDocs(remindersQuery)
    const map: Record<string, { enabled: boolean; daysBefore?: number; remindAt?: any }> = {}
    remindersSnap.docs.forEach((d) => {
      const row = d.data() as any
      if (row.examId) {
        const key = String(row.examId)
        const existing = map[key]
        const daysBefore =
          typeof row.daysBefore === "number" && Number.isFinite(row.daysBefore)
            ? row.daysBefore
            : undefined
        if (!existing || (typeof daysBefore === "number" && (existing.daysBefore || 99) > daysBefore)) {
          map[key] = { enabled: true, daysBefore, remindAt: row.remindAt }
        }
      }
    })
    setReminders(map)

    const initialDays: Record<string, number> = {}
    Object.entries(map).forEach(([examId, value]) => {
      initialDays[examId] = value.daysBefore || 7
    })
    setDaysConfig((prev) => ({ ...initialDays, ...prev }))
  }

  useEffect(() => {
    fetchExams()
  }, [user, refreshTrigger])

  const runAuthPost = async (url: string, body: unknown) => {
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

  const checkDetails = async (examId: string) => {
    setError(null)
    setWorkingExamId(examId)
    try {
      await runAuthPost("/api/exams/check-details", { examId })
      await fetchExams()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      setWorkingExamId(null)
    }
  }

  const setReminder = async (examId: string, enabled: boolean) => {
    setError(null)
    setWorkingExamId(examId)
    try {
      await runAuthPost(
        enabled ? "/api/exams/reminders/upsert" : "/api/exams/reminders/delete",
        enabled ? { examId, daysBefore: daysConfig[examId] || 7 } : { examId }
      )
      await fetchExams()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      setWorkingExamId(null)
    }
  }

  const formatDate = (value: any) => {
    const date = value?.toDate ? value.toDate() : value ? new Date(value) : null
    if (!date || Number.isNaN(date.getTime())) return "—"
    return date.toLocaleDateString()
  }

  return (
    <div className="grid-cards mt-4">
      {error && <p className="notes-error">{error}</p>}
      {exams.map((exam) => (
        <div
          key={exam.id}
          onClick={() => onSelect(exam)}
          className="card card-pad-5 card-click"
        >
          <p className="font-medium">{exam.name}</p>
          <p className="text-sm mt-2">Status: {exam.status || "interested"}</p>
          <p className="text-sm">Exam date: {formatDate(exam.examDate)}</p>
          <p className="text-sm">Reminder: {reminders[exam.id]?.enabled ? "On" : "Off"}</p>
          {reminders[exam.id]?.enabled && (
            <p className="text-sm">
              Reminder time: {formatDate(reminders[exam.id]?.remindAt)} ({reminders[exam.id]?.daysBefore || 7}{" "}
              day(s) before)
            </p>
          )}

          <div className="mt-3 flex flex-gap-sm" onClick={(e) => e.stopPropagation()}>
            {(exam.status === "applied" || exam.status === "interested") && (
              <button
                type="button"
                className="btn"
                onClick={() => checkDetails(exam.id)}
                disabled={workingExamId === exam.id}
              >
                {workingExamId === exam.id ? "Checking..." : "Check details"}
              </button>
            )}
            <select
              value={daysConfig[exam.id] || 7}
              className="input input-inline"
              onChange={(e) =>
                setDaysConfig((prev) => ({ ...prev, [exam.id]: Number(e.target.value) || 7 }))
              }
              disabled={workingExamId === exam.id || !exam.examDate}
            >
              <option value={1}>1 day before</option>
              <option value={3}>3 days before</option>
              <option value={7}>7 days before</option>
              <option value={14}>14 days before</option>
            </select>
            <button
              type="button"
              className="btn"
              onClick={() => setReminder(exam.id, !reminders[exam.id]?.enabled)}
              disabled={workingExamId === exam.id || (!reminders[exam.id]?.enabled && !exam.examDate)}
            >
              {reminders[exam.id]?.enabled ? "Remove reminder" : "Set reminder"}
            </button>
          </div>
          {!exam.examDate && (
            <p className="text-xs mt-2">Set an exam date first, then you can schedule reminder alerts.</p>
          )}
        </div>
      ))}
    </div>
  )
}
