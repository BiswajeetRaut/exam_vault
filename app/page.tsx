import Link from "next/link"

export default function Home() {
  return (
    <div className="landing-shell">
      <section className="landing-hero">
        <p className="landing-badge">AI exam workspace</p>
        <h1 className="landing-title">Exam prep that actually feels modern.</h1>
        <p className="landing-subtitle">
          Plan exams, generate notes from YouTube and files, create quizzes, and schedule smart
          reminders in one clean workspace.
        </p>
        <div className="landing-cta-row">
          <Link href="/login" className="btn landing-cta-primary">
            Start for free
          </Link>
          <Link href="/dashboard" className="btn landing-cta-secondary">
            Open dashboard
          </Link>
        </div>
      </section>

      <section className="landing-grid">
        <article className="landing-card">
          <h3>AI Notes</h3>
          <p>
            Turn YouTube and Drive content into structured notes, then save and refine in your own
            workflow.
          </p>
        </article>
        <article className="landing-card">
          <h3>Quiz Generator</h3>
          <p>
            Build adaptive quizzes from your notes, submit answers, and track your accuracy over
            time.
          </p>
        </article>
        <article className="landing-card">
          <h3>Exam Tracker</h3>
          <p>
            Keep exam timelines organized, extract details from uploaded files, and stay prepared
            with reminders.
          </p>
        </article>
        <article className="landing-card">
          <h3>Smart Reminders</h3>
          <p>
            Schedule days-before nudges so you never miss deadlines, admit card updates, or exam
            day prep.
          </p>
        </article>
      </section>
    </div>
  )
}
