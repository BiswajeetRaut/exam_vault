"use client"

import { useState } from "react"
import CreateExam from "@/components/CreateExam"
import ExamList from "@/components/ExamList"
import ExamUpload from "@/components/ExamUpload"
import ExamFiles from "@/components/ExamFiles"

export default function ExamsPage() {

  const [selectedExam, setSelectedExam] = useState<any>(null)
  const [refresh, setRefresh] = useState(0)

  return (
    <div className="page-wide">
      <h1 className="page-title">Exams Vault</h1>

      <CreateExam refresh={() => window.location.reload()} />

      <ExamList onSelect={setSelectedExam} />

      {selectedExam && (
        <div className="mt-10 flex-col-stack-lg">
          <h2 className="section-title">
            {selectedExam.name}
          </h2>

          <ExamUpload
            examId={selectedExam.id}
            onUploadSuccess={() => setRefresh(prev => prev + 1)}
          />

          <ExamFiles
            examId={selectedExam.id}
            refreshTrigger={refresh}
          />
        </div>
      )}
    </div>
  )
}
