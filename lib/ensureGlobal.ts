import { db } from "@/lib/firebase"
import { doc, getDoc, setDoc } from "firebase/firestore"

export const ensureGlobalExists = async () => {

  const globalRef = doc(db, "app_meta", "storage")
  const snap = await getDoc(globalRef)

  if (!snap.exists()) {
    console.log("Creating global storage doc...")

    await setDoc(globalRef, {
      totalUsed: 0,
      createdAt: new Date()
    })
  }

  return globalRef
}