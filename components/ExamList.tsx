"use client"

import { useEffect, useState } from "react"
import { db } from "@/lib/firebase"
import { collection, query, where, getDocs } from "firebase/firestore"
import { useAuth } from "@/context/AuthContext"

export default function ExamList({ onSelect }: any) {

  const { user } = useAuth()
  const [exams, setExams] = useState<any[]>([])

  const fetchExams = async () => {
    if (!user) return

    const q = query(
      collection(db, "exams"),
      where("userId", "==", user.uid)
    )

    const snapshot = await getDocs(q)

    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))

    setExams(data)
  }

  useEffect(() => {
    fetchExams()
  }, [user])

  return (
    <div className="grid-cards">
      {exams.map((exam) => (
        <div
          key={exam.id}
          onClick={() => onSelect(exam)}
          className="card card-pad-5 card-click"
        >
          {exam.name}
        </div>
      ))}
    </div>
  )
}