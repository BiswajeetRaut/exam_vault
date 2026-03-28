"use client"

import { useState } from "react"
import NotesExplorer from "@/components/NotesExplorer"
import CreateNoteFolder from "@/components/CreateNoteFolder"
import Breadcrumbs from "@/components/Breadcrumbs"
import CreateNoteModal from "@/components/CreateNoteModal"
import NotesViewer from "@/components/NotesViewer"

export default function NotesPage() {

  const [currentFolder, setCurrentFolder] = useState<any>(null)
  const [path, setPath] = useState<any[]>([])
  const [selectedNote, setSelectedNote] = useState<any>(null)
  const [showModal, setShowModal] = useState(false)

  const openFolder = (folder: any) => {
    setCurrentFolder(folder.id)
    setPath([...path, folder])
  }
  const handleNavigate = (newPath: any[]) => {
    setPath(newPath)
    setCurrentFolder(newPath.length ? newPath[newPath.length - 1].id : null)
  }
  return (
    <div className="page-wide">
      <h1 className="page-title">Notes</h1>

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
