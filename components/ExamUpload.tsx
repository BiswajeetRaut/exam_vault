"use client"

import { useState } from "react"
import { db } from "@/lib/firebase"
import { supabase } from "@/lib/supabase"
import {
  collection,
  addDoc,
  doc,
  updateDoc
} from "firebase/firestore"
import { useAuth } from "@/context/AuthContext"
import { v4 as uuid } from "uuid"

export default function ExamUpload({ examId, onUploadSuccess }: any) {

  const { user } = useAuth()

  const [file, setFile] = useState<any>(null)
  const [title, setTitle] = useState("")
  const [docType, setDocType] = useState("other")
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
        docType,
        fileUrl: data.publicUrl,
        path: filePath,
        fileType: file.type || "",
        ocrStatus: "pending",
        size: file.size,
        createdAt: new Date()
      })

      if (docType === "admit_card" || docType === "application") {
        await updateDoc(doc(db, "exams", examId), {
          status: docType === "admit_card" ? "admit_card_received" : "applied",
          updatedAt: new Date(),
        })
      }

      setFile(null)
      setTitle("")
      setDocType("other")

      if (onUploadSuccess) onUploadSuccess()

    } catch (err) {
      console.error(err)
      alert("Upload failed")
    }

    setLoading(false)
  }

  return (
    <div className="card card-pad-4 flex-col-stack-sm">
      <p className="text-sm font-medium">Document type</p>
      <div className="flex flex-gap-sm">
        {[
          { key: "admit_card", label: "Admit Card" },
          { key: "application", label: "Application" },
          { key: "notification", label: "Notification" },
          { key: "other", label: "Other" },
        ].map((option) => (
          <button
            key={option.key}
            type="button"
            className={`btn ${docType === option.key ? "btn-primary" : ""}`}
            onClick={() => setDocType(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <input
        type="text"
        placeholder={
          docType === "admit_card"
            ? "File title (Admit Card)"
            : docType === "application"
              ? "File title (Application Proof)"
              : "File title"
        }
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
