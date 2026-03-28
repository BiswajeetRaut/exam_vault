"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { db } from "@/lib/firebase"
import { collection, query, where, getDocs } from "firebase/firestore"
import { useAuth } from "@/context/AuthContext"

export default function FolderList({ onSelect }: any) {

  const { user } = useAuth()
  const [folders, setFolders] = useState<any[]>([])

  const fetchFolders = async () => {
    if (!user) return

    const q = query(
      collection(db, "folders"),
      where("userId", "==", user.uid)
    )

    const snapshot = await getDocs(q)

    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))

    setFolders(data)
  }

  useEffect(() => {
    fetchFolders()
  }, [user])

  return (
    <div className="grid-cards">
      {folders.map((folder) => (
        <motion.div
          key={folder.id}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => onSelect(folder)}
          className="card card-pad-5 card-click"
        >
          <div className="text-lg text-muted">Folder</div>
          <p className="mt-2 font-medium">{folder.name}</p>
        </motion.div>
      ))}
    </div>
  )
}