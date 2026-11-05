# Replace Langflow with native Gemini

The database, storage rules, sign-in, email, scheduled jobs and `vercel.json` stay unchanged. The look of the app stays exactly as it is.

## 1. Remove Langflow
- Rewrite `src/lib/server/ai.server.ts` as a Gemini-only client. Delete `callLangflow`, `callOpenAI`, the provider selection and the fallback logic.
- Remove `AI_PROVIDER`, `AI_FALLBACK`, `LANGFLOW_*` and `OPENAI_*` from `.env.example` and the README.
- Existing conversations, messages, memories and document_processing rows are left as they are.

## 2. Gemini client (server only, no new packages)
- Requests are sent directly to `https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent` using `fetch`.
- The key goes in the `x-goog-api-key` header. It is never placed in a URL, a log or an error message.
- Settings:
  - `GEMINI_API_KEY` (required)
  - `GEMINI_MODEL` (default `gemini-3.5-flash-lite`)
  - `GEMINI_TIMEOUT_MS` (default 45000, kept under Vercel's 60 s Hobby limit)
- The system prompt becomes `systemInstruction`. Chat turns become `contents`, with the assistant role mapped to `model`. Consecutive same-role turns are merged so the request always ends with a user turn.
- Structured output uses `responseMimeType: application/json` plus `responseSchema`. The reply is then checked again with zod.
- Files go in as `inlineData` parts with the right MIME type (base64). This covers PDF, JPG, PNG and WEBP up to the existing 20 MB upload limit. Large files are capped at the inline-request limit, with a clear error when exceeded.
- One shared error type maps provider responses to clear messages:
  - 400: invalid request or file.
  - 401 or 403: the AI key is invalid or not allowed.
  - 404: the configured model isn't available.
  - 429: rate limit or quota used up, try later. This includes Retry-After.
  - 5xx: the AI service is unavailable.
  - Timeout.
  - Safety block or empty reply.
- One bounded retry with backoff, for 429 and 5xx only, and only while time remains before the timeout.
- Provider details are logged on the server only, never the key.

## 3. Chat (`sendChat`)
- Same flow and same security: `requireUser`, owner-scoped queries, history capped at 10 turns and memories capped at 15, the memory tag extraction and saving of both turns.
- On an AI failure the user's message stays saved and a clear error is returned. No fake assistant reply is written.

## 4. Documents and images (`analyzeDocument`)
- **PDF**: text is pulled out with unpdf first. If too little text comes back (a scanned PDF), the PDF itself is sent to Gemini for native reading.
- **DOCX and TXT**: unchanged text extraction, then Gemini.
- **JPG, JPEG, PNG and WEBP**: new. The image is sent to Gemini to be read.
- **Timetable**: a strict JSON schema in the request, then the existing zod validation. Results are still reviewed by the user before anything is saved to timetables. Invalid or empty JSON marks the job as failed, and nothing partial is saved.
- **Summary**: an empty reply marks the job as failed instead of saving an empty summary.
- **Upload screen** (`documents.tsx`): only the accepted file types and the hint text change to add images. The layout stays the same. Files keep the same private `<user_id>/...` path in the private bucket.

## 5. Docs and tests
- Update `.env.example`, the README AI section and the AI rule in `AGENTS.md`.
- Add a small unit test file for the Gemini request builder: role mapping, ending on a user turn, error-status mapping and the scanned-PDF threshold. Run it together with the existing `metrics.test.ts`.
- Check the build log.

## 6. Verification limits
- Without a real `GEMINI_API_KEY`, live chat and analysis can't be tested. They will be reported as untested.
- `gemini-3.5-flash-lite` will be checked against Google's model list once a key is available. If it isn't listed, `GEMINI_MODEL` can be changed with no code edit.
- After the build, I'll ask you to add `GEMINI_API_KEY` through the secure secret form, then test one chat reply and one document analysis live.

## Final report
The report will cover:
- A. Files modified.
- B. Langflow parts removed.
- C. Gemini integration details.
- D. New settings.
- E. Test and build results.
- F. Remaining setup outside the app.
