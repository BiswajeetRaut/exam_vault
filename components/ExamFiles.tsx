"use client"

import { useEffect, useState } from "react"
import { auth, db } from "@/lib/firebase"
import { supabase } from "@/lib/supabase"
import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc
} from "firebase/firestore"

export default function ExamFiles({ examId, refreshTrigger }: any) {

  const [files, setFiles] = useState<any[]>([])
  const [workingId, setWorkingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchFiles = async () => {
    const q = query(
      collection(db, "exam_files"),
      where("examId", "==", examId)
    )

    const snapshot = await getDocs(q)

    setFiles(snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })))
  }

  useEffect(() => {
    fetchFiles()
  }, [examId, refreshTrigger])

  const handleDelete = async (file: any) => {

    await supabase.storage.from("files").remove([file.path])

    await deleteDoc(doc(db, "exam_files", file.id))

    fetchFiles()
  }

  const extractDetails = async (file: any) => {
    setError(null)
    setWorkingId(file.id)
    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) throw new Error("Not signed in")

      const res = await fetch("/api/exams/files/extract", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ examFileId: file.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Could not extract details")

      await fetchFiles()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      setWorkingId(null)
    }
  }

  return (
    <div className="mt-6 flex-col-stack">
      {error && <p className="notes-error">{error}</p>}
      {files.map((file) => (
        <div key={file.id} className="card card-pad-4">
          <h3 className="font-semibold">{file.title}</h3>
          <p className="text-sm mt-2">OCR: {file.ocrStatus || "not started"}</p>
          {file.extracted?.examDate && (
            <p className="text-sm">Detected date: {String(file.extracted.examDate)}</p>
          )}
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
              className="btn btn-danger"
              onClick={() => handleDelete(file)}
            >
              Delete
            </button>
          </div>
          <div className="mt-3">
            <button
              type="button"
              className="btn"
              onClick={() => extractDetails(file)}
              disabled={workingId === file.id}
            >
              {workingId === file.id ? "Extracting..." : "Extract details (OCR)"}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
