"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { db } from "@/lib/firebase"
import { collection, addDoc } from "firebase/firestore"
import { useAuth } from "@/context/AuthContext"

export default function CreateFolder({ refresh }: any) {

  const { user } = useAuth()
  const [name, setName] = useState("")

  const createFolder = async () => {
    if (!name || !user) return

    await addDoc(collection(db, "folders"), {
      userId: user.uid,
      name,
      createdAt: new Date()
    })

    setName("")
    refresh()
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card card-pad-4 flex flex-gap-md"
    >
      <input
        type="text"
        placeholder="New folder name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="input"
      />

      <button type="button" onClick={createFolder} className="btn btn-primary">
        Create
      </button>
    </motion.div>
  )
}