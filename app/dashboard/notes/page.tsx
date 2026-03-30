"use client"

import { useState } from "react"
import NotesExplorer from "@/components/NotesExplorer"
import CreateNoteFolder from "@/components/CreateNoteFolder"
import Breadcrumbs from "@/components/Breadcrumbs"
import CreateNoteModal from "@/components/CreateNoteModal"
import NotesViewer from "@/components/NotesViewer"

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

export default function NotesPage() {

  const [currentFolder, setCurrentFolder] = useState<string | null>(null)
  const [path, setPath] = useState<NoteFolder[]>([])
  const [selectedNote, setSelectedNote] = useState<NoteItem | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const openFolder = (folder: NoteFolder) => {
    setCurrentFolder(folder.id)
    setPath([...path, folder])
  }
  const handleNavigate = (newPath: NoteFolder[]) => {
    setPath(newPath)
    setCurrentFolder(newPath.length ? newPath[newPath.length - 1].id : null)
  }
  return (
    <div className="page-wide">
      <h1 className="page-title">Notes</h1>

      <div className="search-wrap">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search notes and folders..."
          className="input notes-search-input"
          aria-label="Search notes and folders"
        />
      </div>

      <Breadcrumbs path={path} onNavigate={handleNavigate} />

      <CreateNoteFolder
        parentId={currentFolder}
        refresh={() => window.location.reload()}
      />

      <button
        type="button"
        className="btn btn-primary mt-4"
        onClick={() => setShowModal(true)}
      >
        + New Note
      </button>

      <NotesExplorer
        currentFolder={currentFolder}
        searchQuery={searchQuery}
        onOpenFolder={openFolder}
        onOpenNote={setSelectedNote}
      />

      {selectedNote && (
        <NotesViewer note={selectedNote} />
      )}

      {showModal && (
        <CreateNoteModal
          folderId={currentFolder}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
