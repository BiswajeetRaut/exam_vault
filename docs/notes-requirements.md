# Notes module requirements (implementation roadmap)

## 1) Core note generation
- Support note creation from:
  - YouTube transcript/captions.
  - Uploaded files (PDF/DOCX/images) after OCR.
  - External links (optional extraction).
- Keep raw source text and generation metadata per note.

## 2) Long transcript handling (implemented)
- Chunk long transcript into bounded windows with overlap.
- Run per-chunk summary (map step).
- Merge chunk summaries into one deduplicated final note (reduce step).
- Persist generation source and timestamps.

## 3) RAG indexing (phase 1 implemented)
- Store embeddings at note chunk level in vector DB.
- Attach metadata: user id, folder id, note id, chunk index, source type.
- Re-index on demand via "Store to RAG" action.

## 4) Folder-level retrieval behavior
- Query scope modes required:
  - current note only,
  - selected notes,
  - entire folder,
  - all user notes (optional advanced mode).
- Filter by ownership and folder boundaries.

## 5) Quiz generation flow
- User selects one/multiple notes.
- Backend retrieves relevant chunks from vector DB.
- Generate question set (MCQ + descriptive optional).
- No timer mode.
- On submission: show score + answer key + rationale.

## 6) Per-question tutor bot (strict scope)
- Each question opens a bound chat assistant.
- Assistant context is limited to:
  - question text,
  - correct answer,
  - retrieved supporting chunks.
- Out-of-scope prompts must be refused with guidance.

## 7) File-to-RAG button flow
- Add "Store to RAG" for drive files/documents.
- Pipeline:
  1) fetch file,
  2) OCR/text extraction,
  3) chunking,
  4) embeddings,
  5) upsert vectors.
- Track indexing status and errors per file.

## 8) Conversational note editing
- Chat with note context to propose edits.
- User can accept/reject patch-style note changes.
- Preserve revision history.

## 9) Reliability & guardrails
- Token budgeting and chunk limits.
- Retry/transient failure handling.
- PII-safe logging and telemetry.
- Idempotent re-indexing.

## 10) Data model additions
- `notes`: summary, summary metadata, rag index metadata, revision metadata.
- `note_items`: source artifacts and extraction status.
- `note_embeddings` (vector db): embedding rows per chunk.
- `quiz_attempts`, `quiz_questions`, `question_threads` for assessment + tutoring.
