# Replace Langflow with Native Gemini — Final Implementation Specification

Implement the following changes to Vincify. This is a controlled AI-provider migration, not a rebuild.

**Critical preservation requirements:**

- Keep the existing UI, design, layout, theme, navigation and user experience exactly as they are.
- Preserve the existing Supabase project, database records, tables, authentication, RLS policies, private storage bucket, storage rules, email configuration, scheduled jobs and `vercel.json`.
- Do not reset, recreate, migrate, delete or unnecessarily modify existing database data or infrastructure.
- Do not modify unrelated features.
- Do not introduce unnecessary dependencies or packages.
- Preserve existing conversations, messages, AI memories, documents and `document_processing` records.

## 1. Remove Langflow completely

- Rewrite `src/lib/server/ai.server.ts` as a native Gemini-only client.
- Remove `callLangflow`, `callOpenAI`, provider selection, fallback logic and obsolete Langflow/OpenAI integration code.
- Remove `AI_PROVIDER`, `AI_FALLBACK`, `LANGFLOW_*` and `OPENAI_*` from `.env.example`, the README and relevant AI configuration documentation.
- Keep existing application interfaces and function contracts compatible wherever possible so that other features continue working.

## 2. Native Gemini integration — server-side only

Use Google's native Gemini REST API through `fetch`, without adding a new package.

Endpoint:

`https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent`

Security:

- Send the API key through the `x-goog-api-key` header.
- Never expose the key in browser code, frontend environment variables, URLs, logs, error messages or API responses.
- Keep all Gemini requests on the server.

Environment variables:

- `GEMINI_API_KEY` — required.
- `GEMINI_MODEL` — default `gemini-3.5-flash-lite`.
- `GEMINI_TIMEOUT_MS` — default `45000`.

Request handling:

- Convert the existing system prompt into Gemini's `systemInstruction`.
- Map conversation turns into Gemini `contents`, mapping assistant messages to the `model` role.
- Merge consecutive messages with the same role where required.
- Ensure the request ends with a valid user turn without silently discarding conversation history.
- Support structured output using `responseMimeType: application/json` and `responseSchema`.
- Validate structured responses again using the existing Zod validation.

Error handling:  
Use a shared error type to handle:

- HTTP 400: invalid request or unsupported file.
- HTTP 401/403: invalid or unauthorized API key.
- HTTP 404: configured model unavailable.
- HTTP 429: rate limit or quota exceeded, including `Retry-After` where available.
- HTTP 5xx: Gemini service unavailable.
- Request timeout.
- Safety-blocked or empty responses.

Implement one bounded retry with backoff for HTTP 429 and 5xx responses only, and only while the configured timeout permits.

Log useful diagnostic details on the server without logging API keys, document contents or sensitive user information.

## 3. Chat functionality (`sendChat`)

Preserve the existing chat workflow and security:

- Keep `requireUser` authentication.
- Keep owner-scoped database queries.
- Retain the existing history limit of 10 turns.
- Retain the existing AI memory limit of 15.
- Preserve memory-tag extraction and memory-saving behaviour.
- Continue saving both user and assistant messages when successful.
- On Gemini failure, keep the user's message saved and return a clear error. Do not create a fake assistant response.

**Important:** Ordinary AI chat messages must not count toward the daily document-analysis quota introduced in Section 6.

## 4. Document and image analysis (`analyzeDocument`)

Support the following file types:

- PDF
- DOCX
- TXT
- JPG/JPEG
- PNG
- WEBP

Processing requirements:

**PDF files**

- Preserve text extraction using `unpdf`.
- Use Gemini's native PDF understanding when visual context is important, including documents containing charts, tables, diagrams, scanned pages, complex layouts or other visual information.
- Do not rely exclusively on extracted text when doing so would lose important information.
- Scanned PDFs with little or no extractable text must be analysed using Gemini's native PDF capabilities.
- Ensure that both textual and visual content can be interpreted where appropriate.

**DOCX and TXT**

- Preserve the existing text-extraction process and send the extracted content to Gemini.

**Images**

- Add JPG, JPEG, PNG and WEBP support.
- Send images to Gemini with the correct MIME type so that it can interpret their contents.

**Timetable analysis**

- Use a strict JSON schema in the Gemini request.
- Validate the returned data using the existing Zod validation.
- Preserve the current user-review process before timetable entries are saved.
- If the response is invalid or empty, mark processing as failed and do not save partial timetable records.

**Document summaries**

- Do not save empty summaries.
- If Gemini returns an empty or unusable response, mark the processing job as failed and return a clear error.

## 5. Secure Supabase document storage and Vercel compatibility

This requirement is mandatory.

Vincify already uses an existing private Supabase Storage bucket with a 20 MB application upload limit. Preserve it.

The browser must upload documents directly to the existing private Supabase Storage bucket. Large file binaries must never be sent through a Vercel serverless function.

The correct processing flow must be:

1. The authenticated user uploads the document directly from the browser to the existing private Supabase Storage bucket.
2. The existing user-folder storage path and ownership rules are preserved.
3. The document-analysis request sends only the authenticated document ID or storage path, not the document binary.
4. The server authenticates the user using the existing authentication mechanism.
5. The server retrieves the document record from Supabase and independently verifies that the record belongs to the authenticated user.
6. The server verifies that the requested storage path belongs to that user and matches the stored document record. Do not trust an arbitrary storage path supplied by the browser.
7. The server securely retrieves the file from the private Supabase Storage bucket.
8. The server sends the file to Gemini using the appropriate `inlineData` MIME type and Base64 encoding.
9. The server returns the analysis result through the existing application workflow.

Additional security requirements:

- Never make the private bucket public.
- Never expose the Supabase service-role key to the browser.
- If the service-role key is used server-side to retrieve files, independently verify user ownership before accessing the file because the service-role key bypasses RLS.
- Preserve existing RLS policies and user-folder access restrictions.
- Preserve the existing 20 MB application upload limit.
- Do not route 20 MB document binaries through Vercel functions. This avoids exceeding Vercel's 4.5 MB function request-body limit.
- Handle file-size and unsupported-file errors clearly.

## 6. Daily document-analysis quota — 3 documents per user

Introduce a daily AI document-analysis limit.

**Default limit: 3 documents per authenticated user per day.**

Requirements:

1. Each authenticated user may successfully submit a maximum of 3 document-analysis requests per day.
2. Apply the limit across all supported document types: PDF, DOCX, TXT, JPG, JPEG, PNG and WEBP.
3. Reset each user's allowance at midnight in the `Africa/Dar_es_Salaam` timezone (UTC+3).
4. Enforce the quota on the server before making a Gemini API request. Frontend-only restrictions are not sufficient.
5. Track usage independently for each authenticated user.
6. Count accepted analysis requests, not failed uploads or requests rejected before processing.
7. Ensure that a user cannot bypass the limit by submitting multiple simultaneous requests. Quota reservation and enforcement must be atomic.
8. If a request is accepted and Gemini subsequently fails, handle the quota consistently and transparently; do not allow repeated failed requests to create unlimited Gemini consumption.
9. Display the user's remaining daily analyses in the existing document interface without changing the design. Example: `2 of 3 analyses remaining today`.
10. When the user reaches the limit, prevent further Gemini document-analysis requests and display a clear message explaining that the allowance resets at midnight Tanzania time.
11. Ordinary AI chat messages must remain unlimited by this document quota and must not consume document-analysis allowances.
12. Keep the limit configurable through a server-side environment variable, with a default value of `3`.
13. Store and enforce usage using the existing Supabase database architecture. Before creating a new table or changing the database schema, inspect the existing tables and determine whether an appropriate usage-tracking structure already exists.
14. Avoid duplicate tables, unnecessary schema changes and modifications to existing records.
15. Do not allow users to change their own quota or manipulate their usage records from the frontend.

## 7. Upload interface

Update `documents.tsx` only as necessary to:

- Accept the newly supported image formats.
- Update the accepted-file-type hint.
- Display the remaining daily document-analysis allowance.
- Display a clear message when the daily quota has been exhausted.

Preserve the existing layout, styling, theme, spacing and overall design. Do not redesign the upload interface.

Preserve the existing private storage bucket and `<user_id>/...` storage path convention.

## 8. Documentation and tests

Update:

- `.env.example`
- README AI configuration section
- Relevant AI rules in `AGENTS.md`

Remove obsolete Langflow/OpenAI configuration instructions and document the new Gemini environment variables.

Add focused unit tests covering:

- Gemini request construction.
- User/model role mapping.
- Consecutive same-role message handling.
- Valid final user turn.
- Error-status mapping.
- Scanned-PDF detection and native PDF fallback.
- Daily quota enforcement, including simultaneous requests and daily reset calculations.

Run the new tests together with the existing `metrics.test.ts`.

Run the production build and inspect the build log. Report any warnings or failures accurately.

## 9. Verification and implementation boundaries

Without a real `GEMINI_API_KEY`, live Gemini chat and document analysis cannot be fully tested. Clearly identify these as untested rather than claiming they work.

Verify the configured model against Google's available model list once the API key is available. If the model is unavailable, allow the model to be changed through `GEMINI_MODEL` without code modifications.

After implementation, request that I add `GEMINI_API_KEY` through the secure secret/environment-variable interface. Never ask me to paste the key into ordinary chat or source code.

After the key is configured, guide me through testing:

- One normal AI chat interaction.
- One PDF analysis.
- One image analysis.
- One timetable analysis.
- The three-document daily quota and the rejection of a fourth analysis.
- Confirmation that the allowance resets at the correct Tanzania-local midnight.

## 10. Final implementation report

Provide a clear report covering:

A. Files modified.

B. Langflow and obsolete OpenAI integration code removed.

C. Gemini integration and model configuration.

D. Secure document-upload and private-storage processing flow.

E. Supported document and image formats, including native PDF visual analysis.

F. Daily quota implementation and how usage is stored, enforced and reset.

G. Tests executed and their results.

H. Production build results.

I. Environment variables and remaining external setup.

J. Any features that remain untested or incomplete.

**Final instruction:** Implement only the changes specified above. Preserve Vincify's existing design, Supabase data, security policies, authentication, storage and unrelated functionality. Do not rebuild the application or introduce unnecessary infrastructure changes. remember the style and themes of how the UI appears should remain the same

Before implementation, inspect the existing architecture and confirm that the proposed document-processing flow, quota storage and quota enforcement fit the current Supabase/Vercel setup. If any requirement cannot be implemented safely without a database or infrastructure change, explain the exact change and request approval before proceeding. Do not silently make destructive or unrelated changes.