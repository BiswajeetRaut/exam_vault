"use client"

import { useEffect, useState } from "react"
import { db } from "@/lib/firebase"
import {
  collection,
  query,
  where,
  getDocs
} from "firebase/firestore"
import { useAuth } from "@/context/AuthContext"

export default function NotesExplorer({ currentFolder, onOpenFolder, onOpenNote }: any) {

  const { user } = useAuth()
  const [folders, setFolders] = useState<any[]>([])
  const [notes, setNotes] = useState<any[]>([])

  const fetchData = async () => {
    if (!user) {
      setFolders([])
      setNotes([])
      return
    }

    const folderQuery = query(
      collection(db, "note_folders"),
      where("parentId", "==", currentFolder || null),
      where("userId", "==", user.uid)
    )

    const folderSnap = await getDocs(folderQuery)

    setFolders(folderSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })))

    const notesQuery = query(
      collection(db, "notes"),
      where("folderId", "==", currentFolder || null),
      where("userId", "==", user.uid)
    )

    const notesSnap = await getDocs(notesQuery)

    setNotes(notesSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })))
  }

  useEffect(() => {
    fetchData()
  }, [currentFolder, user])

  return (
    <div className="flex-col-stack-sm mt-4">
      {folders.map(folder => (
        <div
          key={folder.id}
          onClick={() => onOpenFolder(folder)}
          className="card card-pad-3 card-click"
        >
          {folder.name}
        </div>
      ))}

      {notes.map(note => (
        <div
          key={note.id}
          onClick={() => onOpenNote(note)}
          className="card card-pad-3 card-click"
        >
          {note.title}
        </div>
      ))}
    </div>
  )
}