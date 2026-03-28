import { initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"
import { getStorage } from "firebase/storage"

const firebaseConfig = {
    apiKey: "AIzaSyDfvg4G4z92YhmZwZ-4LW7yGbLAedJZVjA",
    authDomain: "exam-vault-67559.firebaseapp.com",
    projectId: "exam-vault-67559",
    storageBucket: "exam-vault-67559.firebasestorage.app",
    messagingSenderId: "596682584149",
    appId: "1:596682584149:web:c27f4ebb4ff867b8a864dc",
    measurementId: "G-PPWKGYW5KD"
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)