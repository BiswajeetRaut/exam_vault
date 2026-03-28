"use client"

import { useEffect, useState } from "react"
import { db } from "@/lib/firebase"
import { collection, getDocs } from "firebase/firestore"
import { motion } from "framer-motion"

export default function NotesSidebar({ onSelect, onCreate }: any) {

  const [notes, setNotes] = useState<any[]>([])

  const fetchNotes = async () => {
    const snapshot = await getDocs(collection(db, "notes"))

    setNotes(snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })))
  }

  useEffect(() => {
    fetchNotes()
  }, [])

  return (
    <div className="notes-sidebar-panel">
      <button
        type="button"
        onClick={onCreate}
        className="btn btn-primary w-full mb-4"
      >
        + New Note
      </button>

      {notes.map((note) => (
        <motion.div
          key={note.id}
          whileHover={{ y: -1 }}
          onClick={() => onSelect(note)}
          className="card card-pad-3 mb-2 card-click"
        >
          {note.title}
        </motion.div>
      ))}
    </div>
  )
}