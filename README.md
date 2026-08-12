# Kimsy

Kimsy turns a regulated firm's existing compliance risk framework into an AI-assisted assessment and review workflow. It supports organization-wide first-line-led and compliance-led operating models without allowing AI to approve assessment decisions.

## Included vertical slice

- Framework import for PDF, DOCX, XLSX, and CSV with stable source locators
- Draft validation and immutable framework publication model
- Periodic business-unit assessment cycles
- First-line-led and compliance-led workflows
- Plain-language fact gathering and optional information requests
- Provider-neutral AI interface with OpenAI structured outputs
- Deterministic offline AI fallback for local evaluation
- Human acceptance, evidence review, exceptions, and finalization gates
- Management dashboard and generated PDF report
- Conditional Supabase magic-link authentication
- Supabase schema with tenant keys, RLS, private storage, background jobs, and append-only audit history

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. With no environment variables, the application runs as an interactive seeded product demo and persists changes in browser local storage.

Copy `.env.example` to `.env.local` to activate external services. When Supabase variables are present, invite-only magic-link authentication is enforced. When `OPENAI_API_KEY` is present, the OpenAI adapter replaces the deterministic local assessment provider.

## Database

Create an EU-region Supabase project and apply [001_initial.sql](./supabase/migrations/001_initial.sql). Add the first user to `organization_members` after creating the organization and accepting the authentication invite.

## Validation

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

The AI integration uses the Responses API with a strict Zod schema. Each run records provider, model, prompt version, output, status, and input hash in the production data model. Model output can only reference risk scenario IDs supplied from the assessment's published framework version.
