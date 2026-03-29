"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import type { ReactNode } from "react"
import { auth } from "@/lib/firebase"
import { signOut } from "firebase/auth"

export default function DashboardLayout({ children }: { children: ReactNode }) {

  const pathname = usePathname()
  const router = useRouter()

  const navLink = (href: string, label: string) => {
    const isActive = pathname === href
    return (
      <Link
        href={href}
        className={`nav-item${isActive ? " nav-item-active" : ""}`}
      >
        {label}
      </Link>
    )
  }

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">Exam Vault</div>
        {navLink("/dashboard", "Dashboard")}
        {navLink("/dashboard/notes", "Notes")}
        {navLink("/dashboard/quizzes", "Quizzes")}
        {navLink("/dashboard/personal", "Personal")}
        {navLink("/dashboard/exams", "Exams")}
        <button
          type="button"
          className="nav-item nav-item-logout"
          onClick={async () => {
            await signOut(auth)
            router.push("/login")
          }}
        >
          Logout
        </button>
      </aside>

      <main className="main-content">
        {children}
      </main>
    </div>
  )
}
