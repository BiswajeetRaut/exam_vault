"use client"

import { useEffect, useMemo, useState } from "react"
import { db } from "@/lib/firebase"
import {
  collection,
  query,
  where,
  getDocs
} from "firebase/firestore"
import { useAuth } from "@/context/AuthContext"

type NoteFolder = {
  id: string
  name?: string
}

type NoteItem = {
  id: string
  title?: string
  content?: string
  text?: string
}

type NotesExplorerProps = {
  currentFolder: string | null
  searchQuery: string
  onOpenFolder: (folder: NoteFolder) => void
  onOpenNote: (note: NoteItem) => void
}

export default function NotesExplorer({ currentFolder, searchQuery, onOpenFolder, onOpenNote }: NotesExplorerProps) {

  const { user } = useAuth()
  const [folders, setFolders] = useState<NoteFolder[]>([])
  const [notes, setNotes] = useState<NoteItem[]>([])

  useEffect(() => {
    let ignore = false

    const fetchData = async () => {
      if (!user) {
        if (!ignore) {
          setFolders([])
          setNotes([])
        }
        return
      }

      const folderQuery = query(
        collection(db, "note_folders"),
        where("parentId", "==", currentFolder || null),
        where("userId", "==", user.uid)
      )
      const notesQuery = query(
        collection(db, "notes"),
        where("folderId", "==", currentFolder || null),
        where("userId", "==", user.uid)
      )

      const [folderSnap, notesSnap] = await Promise.all([getDocs(folderQuery), getDocs(notesQuery)])

      if (ignore) return
      setFolders(folderSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })))
      setNotes(notesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })))
    }

    fetchData()
    return () => {
      ignore = true
    }
  }, [currentFolder, user])

  const normalizedQuery = (searchQuery || "").trim().toLowerCase()
  const visibleFolders = useMemo(() => folders.filter((folder) =>
    !normalizedQuery || `${folder.name || ""}`.toLowerCase().includes(normalizedQuery)
  ), [folders, normalizedQuery])
  const visibleNotes = useMemo(() => notes.filter((note) => {
    if (!normalizedQuery) return true
    const title = `${note.title || ""}`.toLowerCase()
    const content = `${note.content || note.text || ""}`.toLowerCase()
    return title.includes(normalizedQuery) || content.includes(normalizedQuery)
  }), [notes, normalizedQuery])

  return (
    <div className="flex-col-stack-sm mt-4">
      {visibleFolders.map(folder => (
        <div
          key={folder.id}
          onClick={() => onOpenFolder(folder)}
          className="card card-pad-3 card-click"
        >
          {folder.name}
        </div>
      ))}

      {visibleNotes.map(note => (
        <div
          key={note.id}
          onClick={() => onOpenNote(note)}
          className="card card-pad-3 card-click"
        >
          {note.title}
        </div>
      ))}

      {!visibleFolders.length && !visibleNotes.length && (
        <div className="card card-pad-3">
          No notes or folders match your search.
        </div>
      )}
    </div>
  )
}
