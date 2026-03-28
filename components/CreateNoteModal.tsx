"use client"

import { useState } from "react"
import { db } from "@/lib/firebase"
import { collection, addDoc } from "firebase/firestore"
import { getAccessToken } from "@/lib/googleGIS"
import { uploadToDrive } from "@/lib/uploadToDrive"
import { useAuth } from "@/context/AuthContext"

export default function CreateNoteModal({ folderId, onClose }: any) {

  const { user } = useAuth()

  const [title, setTitle] = useState("")
  const [youtube, setYoutube] = useState("")
  const [links, setLinks] = useState<string[]>([])
  const [newLink, setNewLink] = useState("")
  const [files, setFiles] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [driveToken, setDriveToken] = useState("")
  const addLink = () => {
    if (!newLink) return
    setLinks([...links, newLink])
    setNewLink("")
  }

  // 💾 Save note to Firestore
  const createNote = async () => {

    if (!title) {
      alert("Title required")
      return
    }
    if (!user) {
      alert("You must be signed in")
      return
    }

    try {

      const noteRef = await addDoc(collection(db, "notes"), {
        userId: user.uid,
        title,
        folderId: folderId || null,
        createdAt: new Date()
      })

      // 🎥 YouTube
      if (youtube) {
        await addDoc(collection(db, "note_items"), {
          noteId: noteRef.id,
          type: "youtube",
          content: youtube
        })
      }

      // 🔗 Links
      for (let link of links) {
        await addDoc(collection(db, "note_items"), {
          noteId: noteRef.id,
          type: "link",
          content: link
        })
      }

      // 📄 Drive Files
      for (let file of files) {
        await addDoc(collection(db, "note_items"), {
          noteId: noteRef.id,
          type: "drive",
          content: file
        })
      }

      onClose()

    } catch (err) {
      console.error("Create note error:", err)
      alert("Failed to create note")
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">

        <h2>Create Note</h2>

        {/* 📝 Title */}
        <input
          className="input"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        {/* 🎥 YouTube */}
        <input
          className="input"
          placeholder="YouTube link"
          value={youtube}
          onChange={(e) => setYoutube(e.target.value)}
        />

        <div className="flex-col-stack-sm mt-4">
          <button
            type="button"
            className="btn"
            onClick={async () => {
              try {
                const token = await getAccessToken()
                setDriveToken(token)
                alert("Drive connected")
              } catch (err) {
                console.error(err)
                alert("Google login failed")
              }
            }}
          >
            Connect Google Drive
          </button>
          <input
            type="file"
            onChange={async (e: any) => {
              if (!driveToken) {
                alert("Please connect Google Drive first")
                return
              }
              const file = e.target.files[0]
              if (!file) return
              const uploaded = await uploadToDrive(file, driveToken)
              setFiles(prev => [...prev, { name: file.name, ...uploaded }])
            }}
          />
          {loading && <p className="text-sm">Uploading to Drive…</p>}
          {files.map((f, i) => (
            <p key={i} className="text-sm">{f.name}</p>
          ))}
        </div>

        <div className="flex flex-gap-sm mt-4">
          <input
            className="input"
            placeholder="Add reference link"
            value={newLink}
            onChange={(e) => setNewLink(e.target.value)}
          />
          <button type="button" className="btn" onClick={addLink}>
            Add
          </button>
        </div>

        <div className="mt-6 flex-between">
          <button type="button" className="btn btn-primary" onClick={createNote}>
            Create
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
        </div>

      </div>
    </div>
  )
}