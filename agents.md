# Agent Handoff: md.app

Welcome, agent. This is a local-first Markdown application built with Next.js and Capacitor, running on Cloudflare (D1, R2, Pages).

## 🧩 Architectural Overview
- **Storage**: `src/lib/storage` handles abstraction between Capacitor Filesystem (Android/iOS) and LocalStorage (Web).
- **Indexing**: `src/lib/indexer` handles note metadata and indexing. Refactored in v1.2.8 to use Capacitor `Preferences` for reliable cross-platform persistence.
- **Sync**: `src/lib/sync` handles S3/R2 communication. v1.2.9 added `fullSyncFromCloud` for automatic data parity on login.
- **API Architecture**: `src/lib/api.ts` centralizes environment-aware connectivity, ensuring absolute production URLs on native platforms and relative paths on the web.
- **Database**: Cloudflare D1 handles users, sessions, vaults, audit logs, and shared note metadata.
- **Functions**: `functions/api/` contains the backend Workers.

## 🔑 Important Files
- `src/app/page.tsx`: Primary application entry point. Handles editor, rendering, and sync orchestration.
- `src/lib/api.ts`: Shared utility for API communication.
- `schema.sql`: Source of truth for D1 database.
- `.github/workflows/security-scan.yml`: CI/CD security pipeline.
- `src/lib/crypto.ts`: E2EE logic using Web Crypto API.

## 🛠️ Key Workflows
1.  **Sync Orchestration**: `fullSyncFromCloud` (full parity) vs `syncToCloud` (per-note delta).
2.  **Auth**: Bearer tokens with platform-aware routing (index.html on native, /landing on web).
3.  **Sharing (Form A)**: Inbox-style document transfer.
4.  **E2EE**: Per-vault encryption using AES-256-GCM. Keys are derived from passphrases and NEVER stored.

## 🚩 Guidelines for Next Agent
- **Security**: Repo is monitored by Gitleaks, Semgrep, and Trivy. Ensure new code passes linting and typechecking.
- **Platform Handling**: ALWAYS use `apiFetch` from `@/lib/api` for server communication.
- **Mobile UI**: Maintain the "mobile-first" navigation (sidebar overlay and mobile header) in `page.tsx`.
- **Markdown Rendering**: Interactive checklists use a custom `input` processor with `onMouseDown` for reliable toggling.

## ⏭️ Immediate Next Task
Implement **Form B Sharing (Live Share)**. This requires a presence engine to track active users on a note and handle real-time synchronization.
