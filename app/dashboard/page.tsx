"use client"

import { useAuth } from "@/context/AuthContext"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function Dashboard() {

  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="page-wide">
        <p className="loading-line">Loading…</p>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="page-wide">
      <h1 className="page-title">
        Welcome{user.displayName ? `, ${user.displayName}` : ""}
      </h1>

      <div className="card card-pad-4">
        <p className="text-muted">
          Start managing your notes, exams, and study flow from the sidebar.
        </p>
      </div>
    </div>
  )
}
