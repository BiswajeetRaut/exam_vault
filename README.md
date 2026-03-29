# Exam Vault

Exam Vault is a Next.js app for exam preparation workflows:

- Track exams and deadlines.
- Upload exam-related files and auto-extract structured details.
- Create and maintain notes (including YouTube and Drive-backed note sources).
- Generate quizzes from saved notes and review performance.
- Index note content into vector search (RAG) for future AI features.
- Schedule email reminders for exams.

## Tech stack

### Frontend
- Next.js `16.2.1` (App Router). 
- React `19.2.4`.
- TypeScript.
- Firebase Web SDK for auth + Firestore client access in dashboard pages/components.

### Backend/API
- Next.js Route Handlers (`app/api/**`).
- Firebase Admin SDK for server-side auth verification and Firestore admin operations.
- Node.js runtime for server routes that need crypto/files/network operations.

### AI / data services
- Groq (quiz generation, question chat, transcript summarization/transcription fallbacks).
- OpenAI-compatible embedding/OCR endpoints for file/text extraction.
- Pinecone for vector storage/upsert.
- SerpAPI for exam-date/web enrichment checks.

### Integrations
- Google Identity / Google Drive access token flow for Drive file indexing.
- YouTube transcript + fallback audio extraction/transcription path.
- EmailJS for reminder emails.

## Architecture overview

At a high level, the app uses a hybrid client/server model:

1. **Client (dashboard pages/components)**
   - Authenticated user interacts with React UI.
   - Data reads/writes for standard UI flow happen through Firestore client SDK.
   - Sensitive operations (quiz generation, reminders, OCR, RAG indexing) call protected API routes.

2. **Server (Next.js API routes)**
   - Verifies Firebase Bearer token (`Authorization: Bearer <idToken>`).
   - Uses Firebase Admin to enforce ownership and perform privileged updates.
   - Calls AI/integration providers (Groq, OpenAI-compatible APIs, Pinecone, SerpAPI, EmailJS).

3. **Storage and processing**
   - Firestore is primary operational DB.
   - Pinecone stores vectors for indexed note chunks.
   - Cron endpoint dispatches scheduled reminder emails.

## End-to-end user flow

### 1) Authentication and dashboard
- User signs in (Google/Firebase Auth) and is redirected to dashboard features.
- Dashboard aggregates exam stats, files, and study actions.

### 2) Notes workflow
- User creates note folders and notes.
- A note can include multiple `note_items` (e.g., YouTube link, Drive file, plain link).
- User can generate study summary from YouTube source, edit, and save.
- User can send saved notes to RAG index (`/api/notes/rag/index`).
- User can index individual Drive items into RAG (`/api/notes/rag/index-drive`).

### 3) Quiz workflow
- User selects notes with summaries and creates a quiz.
- Server generates quiz questions via AI and stores quiz document.
- Quiz session endpoint returns sanitized question payload (without answers).
- Submit endpoint evaluates answers, stores attempt + history.
- Question chat endpoint provides tutoring-style feedback for a specific question.

### 4) Exams workflow
- User creates exams and uploads exam files (admit card/application/etc.).
- OCR/extraction endpoint processes uploaded content and parses structured exam details.
- Extracted fields update related exam records and event logs.
- User can manually update/check details and optionally search external exam info.

### 5) Reminder workflow
- User sets reminder timing (days before exam).
- Server creates/upserts reminder records and sends setup confirmation email.
- User can remove reminders; records are disabled/cancelled and removal email is attempted.
- Cron endpoint scans due reminders and dispatches reminder emails.

## Third-party usage (what is used where)

- **Firebase Auth (client + admin):** identity, ID token verification, user profile email fallback.
- **Firestore:** all app domain entities (notes/exams/quizzes/reminders/etc.).
- **Groq:** quiz generation + question chat + transcription/summarization helper paths.
- **OpenAI-compatible APIs:** OCR/text extraction + embeddings.
- **Pinecone:** vector upsert for RAG note chunks.
- **SerpAPI:** exam detail/date lookup support.
- **Google Drive API:** fetch Drive file metadata/content for indexing.
- **YouTube transcript/audio tooling:** note summarization input source.
- **EmailJS:** reminder/setup/removal emails.
- **Vercel Cron:** scheduled POST to reminder dispatch route.

## API surface (high level)

### Notes
- `POST /api/notes/summarize` – generate summary from note sources.
- `PATCH /api/notes/summary` – persist edited summary.
- `POST /api/notes/rag/index` – index note summary chunks into Pinecone.
- `POST /api/notes/rag/index-drive` – index Drive file text/OCR into Pinecone.

### Quizzes
- `POST /api/quizzes/create` – generate/store a quiz from selected notes.
- `GET /api/quizzes/history` – quiz history list.
- `GET /api/quizzes/[quizId]/start` – quiz start payload.
- `POST /api/quizzes/[quizId]/submit` – submit answers + scoring.
- `POST /api/quizzes/[quizId]/question-chat` – question-level tutor chat.

### Exams
- `POST /api/exams/files/extract` – OCR + parse exam details from file.
- `POST /api/exams/check-details` – validate/enrich exam details.
- `POST /api/exams/update-details` – persist edits.
- `POST /api/exams/search` – external exam lookup.
- `POST /api/exams/credentials/reveal` – reveal stored exam credential data.
- `POST /api/exams/reminders/upsert` – set reminder.
- `POST /api/exams/reminders/delete` – disable reminder(s).

### Cron
- `POST /api/cron/exam-reminders` – process and send due reminders (protected by `CRON_SECRET`).

## Database design (Firestore)

> Firestore is schemaless, but the application currently uses these logical collections and fields.

### `users`
- `email` (string)
- other profile metadata as needed.

### `notes`
- `userId` (string)
- `title` (string)
- `summary` (string)
- `folderId` (string | null)
- `ragIndexedAt` (timestamp)
- `ragChunkCount` (number)
- timestamps/metadata.

### `note_items`
- `noteId` (string)
- `type` (`youtube` | `drive` | `link` | ...)
- `content` (type-specific payload)
- `ragIndexedAt` (timestamp, optional)
- `ragChunkCount` (number, optional)

### `note_folders`
- `userId` (string)
- `name` (string)
- `parentId` (string | null)

### `exams`
- `userId` (string)
- `name` (string)
- `examDate` (timestamp)
- `status` (string; e.g., `applied`, `admit_card_received`)
- optional credentials/details metadata.

### `exam_files`
- `userId` (string)
- `examId` (string)
- `fileUrl` (string)
- `fileType` (string)
- `docType` (string)
- OCR lifecycle: `ocrStatus`, `ocrError`, `extracted`, `extractedAt`, `extractedChars`.

### `exam_events`
- `userId` (string)
- `examId` (string)
- `eventType` (string)
- `payload` (object)
- `createdAt` (timestamp)

### `exam_reminders`
- deterministic id pattern: `${userId}_${examId}_${daysBefore}_days_before`
- `userId`, `examId`, `examName`
- `type` (`days_before`)
- `daysBefore` (number)
- `channel` (`email`)
- `enabled` (boolean)
- `status` (`scheduled` | `sent` | `failed` | `cancelled`)
- `remindAt` (timestamp)
- `examDate` (timestamp)
- `sentAt`, `lastError`, `updatedAt`, `createdAt`

### `quizzes`
- `userId` (string)
- `title` (string)
- `questionCount` (number)
- `designNotes` (string)
- `questions` (array: prompt/options/correctIndex/explanation)
- `selectedNoteIds` (array)
- `createdAt` (timestamp)

### `quiz_attempts`
- `userId` (string)
- `quizId` (string)
- `answers` (array)
- `correct`, `total`, `percentage`
- `createdAt`

### `quiz_history`
- `userId` (string)
- `quizId`
- `quizTitle`
- `correct`, `total`, `percentage`
- `createdAt`

### `quiz_question_chats`
- `userId` (string)
- `quizId` (string)
- `questionIndex` (number)
- `questionPrompt` (string)
- `userMessage` (string)
- `assistantReply` (string)
- `createdAt`

### Legacy/other collections referenced by UI
- `folders` (personal docs grouping UI)
- `personal_docs` (personal uploaded docs)

## Environment variables

### Core auth / DB
- Firebase Admin credentials:
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_CLIENT_EMAIL`
  - `FIREBASE_PRIVATE_KEY`

### AI and search
- `GROQ_API_KEY`
- `OPENAI_API_KEY` or `EMBEDDING_API_KEY`
- `EMBEDDING_API_BASE_URL` (optional)
- `PINECONE_API_KEY`
- `PINECONE_INDEX_HOST`
- `PINECONE_NAMESPACE` (optional)
- `PINECONE_API_VERSION` (optional)
- `SERPAPI_KEY`

### Reminders / cron
- `CRON_SECRET`
- `EMAILJS_SERVICE_ID`
- `EMAILJS_TEMPLATE_ID`
- `EMAILJS_PUBLIC_KEY`
- `EMAILJS_PRIVATE_KEY`

### Security
- `EXAM_SECRET_KEY` (for secure credential encryption/decryption)

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Deployment

- Node.js runtime requirement: `>=20.9.0`.
- Build command: `npm run build`.
- Vercel cron is configured in `vercel.json` for `/api/cron/exam-reminders`.

### Firebase Google sign-in setup (important)

If Google signup/login fails on deployed domain with CORS/blocked popup style errors:

1. Firebase Console → **Authentication** → **Settings** → **Authorized domains**:
   - add your production host (example: `your-app.vercel.app`)
   - add any custom domain you use.
2. Google Cloud Console → **APIs & Services** → **Credentials**:
   - for your OAuth client, add the same origin(s) under authorized JavaScript origins.
