"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { db } from "@/lib/firebase"
import { supabase } from "@/lib/supabase"
import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  increment
} from "firebase/firestore"
import { useAuth } from "@/context/AuthContext"

export default function FolderFiles({ folderId, refreshTrigger }: any) {

  const { user } = useAuth()
  const [files, setFiles] = useState<any[]>([])

  const fetchFiles = async () => {
    if (!folderId) return

    const q = query(
      collection(db, "personal_docs"),
      where("folderId", "==", folderId)
    )

    const snapshot = await getDocs(q)

    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))

    setFiles(data)
  }

  useEffect(() => {
    fetchFiles()
  }, [folderId, refreshTrigger])

  const handleDelete = async (file: any) => {
    if (!user) return

    await supabase.storage.from("files").remove([file.path])

    await deleteDoc(doc(db, "personal_docs", file.id))

    await updateDoc(doc(db, "users", user.uid), {
      totalStorageUsed: increment(-file.size)
    })

    await updateDoc(doc(db, "app_meta", "storage"), {
      totalUsed: increment(-file.size)
    })

    fetchFiles()
  }

  return (
    <div className="mt-6 flex-col-stack">
      {files.map((file) => (
        <motion.div
          key={file.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card card-pad-4"
        >
          <h3 className="font-semibold">{file.title}</h3>
          <p className="text-sm mt-2">{file.description}</p>
          <p className="text-xs mt-2">
            {(file.size / (1024 * 1024)).toFixed(2)} MB
          </p>
          <div className="flex-between mt-3">
            <a
              href={file.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="link-accent text-sm"
            >
              Open
            </a>
            <button
              type="button"
              onClick={() => handleDelete(file)}
              className="btn btn-danger"
            >
              Delete
            </button>
          </div>
        </motion.div>
      ))}
    </div>
  )
}