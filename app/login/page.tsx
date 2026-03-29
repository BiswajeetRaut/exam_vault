"use client"

import { auth, db } from "@/lib/firebase"
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect } from "firebase/auth"
import { doc, setDoc, getDoc } from "firebase/firestore"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { FirebaseError } from "firebase/app"

export default function LoginPage() {

  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setLoading(true)

    try {
      const provider = new GoogleAuthProvider()

      const result = await signInWithPopup(auth, provider)
      const user = result.user

      if (!user) {
        throw new Error("No user returned from Google")
      }

      console.log("User logged in:", user.uid)

      const userRef = doc(db, "users", user.uid)
      const userSnap = await getDoc(userRef)

      if (!userSnap.exists()) {
        console.log("Creating new user...")

        await setDoc(userRef, {
          name: user.displayName || "",
          email: user.email || "",
          totalStorageUsed: 0,
          createdAt: new Date()
        })

        console.log("User created successfully")
      } else {
        console.log("User already exists")

        await setDoc(
          userRef,
          {
            name: user.displayName || "",
            email: user.email || "",
            lastLogin: new Date()
          },
          { merge: true }
        )
      }

      setTimeout(() => {
        router.push("/dashboard")
      }, 500)

    } catch (error) {
      console.error("Login error:", error)
      if (error instanceof FirebaseError) {
        if (error.code === "auth/popup-blocked" || error.code === "auth/popup-closed-by-user") {
          await signInWithRedirect(auth, new GoogleAuthProvider())
          return
        }

        if (error.code === "auth/unauthorized-domain") {
          alert(
            "Google sign-in blocked: add your deployed domain in Firebase Auth > Settings > Authorized domains."
          )
        } else {
          alert(`Login failed: ${error.code}`)
        }
      } else {
        alert("Login failed. Check console.")
      }
    }

    setLoading(false)
  }

  return (
    <div className="login-shell">
      <div className="login-panel">
        <h1 className="login-title">Exam Vault</h1>

        <button
          type="button"
          onClick={handleLogin}
          className="btn btn-dark"
          disabled={loading}
        >
          {loading ? "Signing in…" : "Sign in with Google"}
        </button>
      </div>
    </div>
  )
}
