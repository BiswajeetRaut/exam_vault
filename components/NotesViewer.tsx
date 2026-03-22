"use client"

import { useEffect, useState } from "react"
import { db } from "@/lib/firebase"
import { collection, query, where, getDocs } from "firebase/firestore"
import { deleteDoc, doc } from "firebase/firestore"
import { getAccessToken } from "@/lib/googleGIS"
import { deleteFromDrive } from "@/lib/deleteFromDrive"
export default function NotesViewer({ note }: any) {

  const [items, setItems] = useState<any[]>([])
  const [summary, setSummary] = useState("")

  useEffect(() => {
    const fetchItems = async () => {

      const q = query(
        collection(db, "note_items"),
        where("noteId", "==", note.id)
      )

      const snapshot = await getDocs(q)

      setItems(snapshot.docs.map(doc => doc.data()))
    }

    fetchItems()
  }, [note])

  const getYouTubeEmbed = (url: string) => {
    try {
      const regExp = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/;
      const match = url.match(regExp);
      return match ? `https://www.youtube.com/embed/${match[1]}` : "";
    } catch {
      return "";
    }
  }

  return (
    <div>

      <h1 className="title">{note.title}</h1>

      {items.map((item, i) => {

        if (item.type === "youtube") {
          return (
            <iframe
              key={i}
              className="video"
              src={getYouTubeEmbed(item.content)}
              allowFullScreen
            />
          )
        }

        if (item.type === "drive") {
          return (
            <div key={i} className="card card-pad-4 mt-4">
              <p className="font-medium">{item.content.name}</p>
              <div className="flex-between mt-4">
                <a
                  href={item.content.url}
                  target="_blank"
                  rel="noreferrer"
                  className="link-accent text-sm"
                >
                  Open
                </a>
        
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={async () => {
        
                    try {
                      const token = await getAccessToken()
        
                      await deleteFromDrive(item.content.id, token)
        
                      await deleteDoc(doc(db, "note_items", item.id))
        
                      alert("Deleted")
        
                      location.reload()
        
                    } catch (err) {
                      console.error(err)
                      alert("Delete failed")
                    }
        
                  }}
                >
                  Delete
                </button>
              </div>
        
            </div>
          )
        }

        if (item.type === "link") {
          return (
            <a
              key={i}
              href={item.content}
              target="_blank"
              rel="noreferrer"
              className="link-accent text-sm mt-4"
              style={{ display: "inline-block" }}
            >
              {item.content}
            </a>
          )
        }

        return null
      })}

      {/* AI Notes */}
      <div className="card card-pad-4 mt-6">
        <h2 className="section-title mb-4">AI notes</h2>
        {summary ? (
          <textarea
            className="input"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={6}
          />
        ) : (
          <button type="button" className="btn btn-primary">
            Generate summary
          </button>
        )}
      </div>

    </div>
  )
}