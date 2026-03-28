"use client"

import { useEffect, useState } from "react"
import { db } from "@/lib/firebase"
import { collection, addDoc } from "firebase/firestore"
import { useAuth } from "@/context/AuthContext"
export default function CreateNoteFolder({ parentId, refresh }: any) {

  const { user } = useAuth()
  const [name, setName] = useState("")

  const createFolder = async () => {
    if (!name || !user) return

    await addDoc(collection(db, "note_folders"), {
      userId: user.uid,
      name,
      parentId: parentId || null,
      createdAt: new Date()
    })

    setName("")
    refresh()
  }
  return (
    <div className="flex flex-gap-sm mt-4">

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="New Folder"
        className="input"
      />

      <button type="button" onClick={createFolder} className="btn btn-primary">
        Create
      </button>

    </div>
  )
}