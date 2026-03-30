"use client"

import { useAuth } from "@/context/AuthContext"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { collection, getDocs, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { motion } from "framer-motion"

type DashboardStats = {
  totalExams: number
  appliedExams: number
  admitCards: number
  upcomingExams: number
  totalFiles: number
}

type ExamRecord = {
  status?: string
  examDate?: Date | string | { toDate?: () => Date } | null
}

export default function Dashboard() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats>({
    totalExams: 0,
    appliedExams: 0,
    admitCards: 0,
    upcomingExams: 0,
    totalFiles: 0,
  })
  const [statsLoading, setStatsLoading] = useState(true)
  const [showGuide, setShowGuide] = useState(true)

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
    }
  }, [user, loading, router])

  useEffect(() => {
    let ignore = false
    const loadStats = async () => {
      if (!user) return
      setStatsLoading(true)
      const examsSnap = await getDocs(query(collection(db, "exams"), where("userId", "==", user.uid)))
      const filesSnap = await getDocs(
        query(collection(db, "exam_files"), where("userId", "==", user.uid))
      )

      const now = new Date()
      const exams = examsSnap.docs.map((doc) => doc.data() as ExamRecord)
      const next30Days = new Date(now)
      next30Days.setDate(next30Days.getDate() + 30)

      const computed: DashboardStats = {
        totalExams: exams.length,
        appliedExams: exams.filter((exam) => exam.status === "applied").length,
        admitCards: exams.filter((exam) => exam.status === "admit_card_received").length,
        upcomingExams: exams.filter((exam) => {
          const d = exam.examDate?.toDate ? exam.examDate.toDate() : exam.examDate ? new Date(exam.examDate) : null
          if (!d || Number.isNaN(d.getTime())) return false
          return d >= now && d <= next30Days
        }).length,
        totalFiles: filesSnap.size,
      }

      if (!ignore) {
        setStats(computed)
        setStatsLoading(false)
      }
    }
    loadStats().catch(() => !ignore && setStatsLoading(false))
    return () => {
      ignore = true
    }
  }, [user])

  const welcomeMessage = useMemo(() => {
    if (!user?.displayName) return "Welcome back"
    return `Welcome back, ${user.displayName}`
  }, [user?.displayName])

  if (loading) {
    return (
      <div className="page-wide">
        <p className="loading-line">Loading…</p>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="page-wide dashboard-overview">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="dashboard-hero card card-pad-5"
      >
        <p className="dashboard-kicker">Exam Vault Dashboard</p>
        <h1 className="page-title dashboard-hero-title">{welcomeMessage}</h1>
        <p className="text-muted">
          Keep your preparation on track with smart OCR extraction, exam reminders, and study tools in one
          place.
        </p>
        <div className="mt-4 flex flex-gap-sm">
          <Link href="/dashboard/exams" className="btn btn-primary">Manage Exams</Link>
          <Link href="/dashboard/notes" className="btn">Open Notes</Link>
          <Link href="/dashboard/quizzes" className="btn">Take Quiz</Link>
        </div>
      </motion.div>

      {showGuide && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.45 }}
          className="card card-pad-4 mt-4 onboarding-panel"
        >
          <div className="flex-between">
            <h2 className="section-title">Quick start guide</h2>
            <button type="button" className="btn" onClick={() => setShowGuide(false)}>
              Dismiss
            </button>
          </div>
          <p className="text-sm mt-2">Follow these steps to set up your workspace in order.</p>
          <div className="onboarding-grid mt-3">
            <motion.div className="onboarding-step" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
              <span>1</span>
              <div>
                <p className="font-semibold">Add notes</p>
                <p className="text-xs">Create your first note to start building revision material.</p>
              </div>
              <Link href="/dashboard/notes" className="btn">Open Notes</Link>
            </motion.div>
            <motion.div className="onboarding-step" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 }}>
              <span>2</span>
              <div>
                <p className="font-semibold">Upload personal docs</p>
                <p className="text-xs">Store certificates, IDs, and study files in one place.</p>
              </div>
              <Link href="/dashboard/personal" className="btn">Go Personal</Link>
            </motion.div>
            <motion.div className="onboarding-step" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}>
              <span>3</span>
              <div>
                <p className="font-semibold">Create folders</p>
                <p className="text-xs">Organize notes and files by exam or topic.</p>
              </div>
              <Link href="/dashboard/personal" className="btn">Create Folder</Link>
            </motion.div>
          </div>
        </motion.div>
      )}

      <div className="dashboard-stat-grid mt-6">
        <div className="card card-pad-4">
          <p className="text-xs">Total Exams</p>
          <p className="dashboard-stat-value">{statsLoading ? "…" : stats.totalExams}</p>
        </div>
        <div className="card card-pad-4">
          <p className="text-xs">Applied</p>
          <p className="dashboard-stat-value">{statsLoading ? "…" : stats.appliedExams}</p>
        </div>
        <div className="card card-pad-4">
          <p className="text-xs">Admit Cards Received</p>
          <p className="dashboard-stat-value">{statsLoading ? "…" : stats.admitCards}</p>
        </div>
        <div className="card card-pad-4">
          <p className="text-xs">Exams in 30 Days</p>
          <p className="dashboard-stat-value">{statsLoading ? "…" : stats.upcomingExams}</p>
        </div>
        <div className="card card-pad-4">
          <p className="text-xs">Documents Uploaded</p>
          <p className="dashboard-stat-value">{statsLoading ? "…" : stats.totalFiles}</p>
        </div>
      </div>

      <div className="dashboard-bottom-grid mt-6">
        <div className="card card-pad-4">
          <h2 className="section-title">Today’s Focus</h2>
          <ul className="dashboard-list mt-3">
            <li>Upload new admit cards and run OCR extraction.</li>
            <li>Review upcoming exam reminders and confirm dates.</li>
            <li>Create one quiz from your notes to revise faster.</li>
          </ul>
        </div>
        <div className="card card-pad-4">
          <h2 className="section-title">Pro Tip</h2>
          <p className="text-sm mt-2">
            For best OCR results, upload clear PDF or image scans. The extractor now processes PDFs and images
            with an AI OCR pass.
          </p>
        </div>
      </div>
    </div>
  )
}
