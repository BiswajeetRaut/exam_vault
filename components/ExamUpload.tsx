"use client"

import { useState } from "react"
import { db } from "@/lib/firebase"
import { supabase } from "@/lib/supabase"
import {
  collection,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  increment
} from "firebase/firestore"
import { useAuth } from "@/context/AuthContext"
import { v4 as uuid } from "uuid"

export default function ExamUpload({ examId, onUploadSuccess }: any) {

  const { user } = useAuth()

  const [file, setFile] = useState<any>(null)
  const [title, setTitle] = useState("")
  const [loading, setLoading] = useState(false)

  const handleUpload = async () => {

    if (!file || !user) return

    setLoading(true)

    try {
      const filePath = `${user.uid}/exam/${uuid()}-${file.name}`

      await supabase.storage
        .from("files")
        .upload(filePath, file)

      const { data } = supabase.storage
        .from("files")
        .getPublicUrl(filePath)

      await addDoc(collection(db, "exam_files"), {
        userId: user.uid,
        examId,
        title,
        fileUrl: data.publicUrl,
        path: filePath,
        size: file.size,
        createdAt: new Date()
      })

      setFile(null)
      setTitle("")

      if (onUploadSuccess) onUploadSuccess()

    } catch (err) {
      console.error(err)
      alert("Upload failed")
    }

    setLoading(false)
  }

  return (
    <div className="card card-pad-4 flex-col-stack-sm">

      <input
        type="text"
        placeholder="File title (Admit Card)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="input"
      />

      <input
        type="file"
        onChange={(e:any) => setFile(e.target.files[0])}
      />

      <button
        type="button"
        onClick={handleUpload}
        className="btn btn-primary"
      >
        {loading ? "Uploading..." : "Upload"}
      </button>

    </div>
  )
}