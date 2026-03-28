"use client"

import { useState } from "react"
import { db } from "@/lib/firebase"
import { collection, addDoc } from "firebase/firestore"
import { useAuth } from "@/context/AuthContext"

export default function CreateExam({ refresh }: any) {

  const { user } = useAuth()
  const [name, setName] = useState("")

  const createExam = async () => {
    if (!name || !user) return

    await addDoc(collection(db, "exams"), {
      userId: user.uid,
      name,
      createdAt: new Date()
    })

    setName("")
    refresh()
  }

  return (
    <div className="card card-pad-4 flex flex-gap-md">

      <input
        type="text"
        placeholder="Exam name (UPSC 2026)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="input"
      />

      <button type="button" onClick={createExam} className="btn btn-primary">
        Create
      </button>

    </div>
  )
}