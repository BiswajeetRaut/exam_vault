"use client"

import { useEffect, useState } from "react"
import { db } from "@/lib/firebase"
import { collection, query, where, getDocs } from "firebase/firestore"
import { useAuth } from "@/context/AuthContext"

export default function PersonalList() {

  const { user } = useAuth()
  const [docs, setDocs] = useState<any[]>([])

  const fetchDocs = async () => {
    if (!user) return

    const q = query(
      collection(db, "personal_docs"),
      where("userId", "==", user.uid)
    )

    const snapshot = await getDocs(q)

    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))

    setDocs(data)
  }

  useEffect(() => {
    fetchDocs()
  }, [user])

  return (
    <div className="mt-6 flex-col-stack">
      <p className="text-sm">Personal files</p>
      {docs.map((doc) => (
        <div key={doc.id} className="card card-pad-4">
          <h3 className="font-semibold">{doc.title}</h3>
          <p className="text-sm mt-2">{doc.description}</p>
          <p className="text-sm mt-2">
            {(doc.size / (1024 * 1024)).toFixed(2)} MB
          </p>
          <a
            href={doc.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="link-accent mt-3"
            style={{ display: "inline-block" }}
          >
            View file
          </a>
        </div>
      ))}
    </div>
  )
}