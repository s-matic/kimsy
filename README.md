# Kimsy

Kimsy replaces a compliance risk spreadsheet with an AI-assisted assessment conversation and a structured, editable risk register.

The product is designed first for one compliance or risk professional. During onboarding, the user describes or uploads their organization structure, risk scenarios, assessment fields, and scoring methodology. Kimsy proposes a configuration for confirmation rather than imposing a generic GRC model.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

`OPENAI_API_KEY` is required for AI onboarding and assessment conversations. It remains server-side. Without a key, the complete sample workspace can still be explored from the first screen.

## Included local-first slice

- Conversational onboarding with text and multi-file input
- PDF, DOCX, XLSX, CSV, PNG, JPEG, and WebP sources
- Editable organization hierarchy and customer risk-scenario library
- Typed custom assessment fields
- Transparent chained matrix and weighted-threshold calculations
- One assessment conversation per organizational unit and period
- AI register proposals that require explicit human application
- Spreadsheet-style risk register with inline editing
- Optional whole-assessment reviewer mode
- Browser persistence using versioned local storage

Production authentication, Supabase persistence, evidence governance, notifications, exports, and management reporting are intentionally outside this focused slice.

## Validation

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```
