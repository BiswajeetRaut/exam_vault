"use client"

import { useEffect, useState } from "react"
import { auth, db } from "@/lib/firebase"
import { collection, query, where, getDocs } from "firebase/firestore"
import { useAuth } from "@/context/AuthContext"

export default function ExamList({ onSelect }: any) {

  const { user } = useAuth()
  const [exams, setExams] = useState<any[]>([])
  const [reminders, setReminders] = useState<Record<string, boolean>>({})
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
    const map: Record<string, boolean> = {}
    remindersSnap.docs.forEach((d) => {
      const row = d.data() as any
      if (row.examId) map[String(row.examId)] = true
    })
    setReminders(map)
  }

  useEffect(() => {
    fetchExams()
  }, [user])

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
        { examId }
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
          <p className="text-sm">Reminder: {reminders[exam.id] ? "On" : "Off"}</p>

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
            <button
              type="button"
              className="btn"
              onClick={() => setReminder(exam.id, !reminders[exam.id])}
              disabled={workingExamId === exam.id}
            >
              {reminders[exam.id] ? "Remove reminder" : "Set reminder"}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
