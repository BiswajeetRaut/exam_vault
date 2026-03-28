"use client"

import { useEffect, useState } from "react"
import { db } from "@/lib/firebase"
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

  return (
    <div className="mt-6 flex-col-stack">
      {files.map((file) => (
        <div key={file.id} className="card card-pad-4">
          <h3 className="font-semibold">{file.title}</h3>
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
        </div>
      ))}
    </div>
  )
}