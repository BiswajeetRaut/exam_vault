"use client"

import Link from "next/link"
import { motion } from "framer-motion"

const items = [
  { name: "Dashboard", link: "/dashboard" },
  { name: "Personal", link: "/dashboard/personal" },
  { name: "Exams", link: "/dashboard/exams" },
  { name: "Notes", link: "/dashboard/notes" }
]

export default function Sidebar() {
  return (
    <aside className="sidebar" style={{ minHeight: "100vh" }}>
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="sidebar-brand"
      >
        Exam Vault
      </motion.div>

      <div className="flex-col-stack-sm">
        {items.map((item) => (
          <motion.div key={item.name} whileHover={{ x: 2 }}>
            <Link href={item.link} className="nav-item">
              {item.name}
            </Link>
          </motion.div>
        ))}
      </div>
    </aside>
  )
}