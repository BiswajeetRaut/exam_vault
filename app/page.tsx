import Link from "next/link"

export default function Home() {
  return (
    <div className="container hero-home">
      <h1 className="title">Exam Vault</h1>

      <p className="subtitle">
        Your AI-powered study and exam management system
      </p>

      <Link href="/login" className="btn btn-primary">
        Get Started
      </Link>
    </div>
  )
}
