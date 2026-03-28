"use client"

import { useState } from "react"
import CreateFolder from "@/components/CreateFolder"
import FolderList from "@/components/FolderList"
import FileUpload from "@/components/FileUpload"
import FolderFiles from "@/components/FolderFiles"

export default function PersonalPage() {

  const [selectedFolder, setSelectedFolder] = useState<any>(null)
  const [refreshFiles, setRefreshFiles] = useState(0)

  return (
    <div className="page-wide">
      <h1 className="page-title">Personal Vault</h1>

      <CreateFolder refresh={() => window.location.reload()} />

      <FolderList onSelect={setSelectedFolder} />

      {selectedFolder && (
        <div className="mt-10 flex-col-stack-lg">
          <h2 className="section-title">
            {selectedFolder.name}
          </h2>

          <FileUpload
            folderId={selectedFolder.id}
            onUploadSuccess={() => setRefreshFiles(prev => prev + 1)}
          />

          <FolderFiles
            folderId={selectedFolder.id}
            refreshTrigger={refreshFiles}
          />
        </div>
      )}
    </div>
  )
}
