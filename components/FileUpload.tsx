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
import { ensureGlobalExists } from "@/lib/ensureGlobal"

export default function FileUpload({ folderId, onUploadSuccess }: any) {

  const { user } = useAuth()

  const [file, setFile] = useState<any>(null)
  const [title, setTitle] = useState("")
  const [desc, setDesc] = useState("")
  const [loading, setLoading] = useState(false)

  const MAX_FILE_SIZE = 10 * 1024 * 1024
  const USER_LIMIT = 500 * 1024 * 1024
  const GLOBAL_LIMIT = 800 * 1024 * 1024

  const handleUpload = async () => {

    if (!user) return alert("User not logged in")
    if (!folderId) return alert("Select a folder first")
    if (!file) return alert("Select a file")

    if (file.size > MAX_FILE_SIZE) {
      return alert("File too large (max 10MB)")
    }

    setLoading(true)

    try {
      const userRef = doc(db, "users", user.uid)
      const userSnap = await getDoc(userRef)
      const userUsed = userSnap.data()?.totalStorageUsed || 0

      if (userUsed + file.size > USER_LIMIT) {
        setLoading(false)
        return alert("User storage limit exceeded")
      }

      const globalRef = await ensureGlobalExists()
      const globalSnap = await getDoc(globalRef)
      const globalUsed = globalSnap.data()?.totalUsed || 0

      if (globalUsed + file.size > GLOBAL_LIMIT) {
        setLoading(false)
        return alert("App storage full")
      }

      const filePath = `${user.uid}/${uuid()}-${file.name}`

      const { error } = await supabase.storage
        .from("files")
        .upload(filePath, file)

      if (error) throw error

      const { data } = supabase.storage
        .from("files")
        .getPublicUrl(filePath)

      const fileUrl = data.publicUrl

      await addDoc(collection(db, "personal_docs"), {
        userId: user.uid,
        folderId,
        title,
        description: desc,
        fileUrl,
        path: filePath,
        size: file.size,
        createdAt: new Date()
      })

      await updateDoc(userRef, {
        totalStorageUsed: increment(file.size)
      })

      await updateDoc(globalRef, {
        totalUsed: increment(file.size)
      })

      setFile(null)
      setTitle("")
      setDesc("")

      alert("Uploaded successfully")

      if (onUploadSuccess) onUploadSuccess()

    } catch (err) {
      console.error(err)
      alert("Upload failed")
    }

    setLoading(false)
  }

  return (
    <div className="surface-bordered flex-col-stack card-pad-5">
      <h2 className="font-semibold">Upload file</h2>

      <input
        type="text"
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="input"
      />

      <input
        type="text"
        placeholder="Description"
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        className="input"
      />

      <input
        type="file"
        onChange={(e: any) => setFile(e.target.files?.[0] ?? null)}
      />

      {file && (
        <p className="text-sm">
          {(file.size / (1024 * 1024)).toFixed(2)} MB
        </p>
      )}

      <button
        type="button"
        onClick={handleUpload}
        className="btn btn-dark"
      >
        {loading ? "Uploading…" : "Upload"}
      </button>
    </div>
  )
}
