# Agent Handoff: md.app

Welcome, agent. This is a local-first Markdown application built with Next.js and Capacitor, running on Cloudflare (D1, R2, Pages).

## 🧩 Architectural Overview
- **Storage**: `src/lib/storage` handles abstraction between Capacitor Filesystem (Android) and LocalStorage (Web).
- **Indexing**: `src/lib/indexer` handles note metadata and full-text indexing (stored in LocalStorage).
- **Sync**: `src/lib/sync` handles S3/R2 communication.
- **Database**: Cloudflare D1 handles users, sessions, vaults, audit logs, and shared note metadata.
- **Functions**: `functions/api/` contains the backend Workers.

## 🔑 Important Files
- `src/app/page.tsx`: The primary application entry point. Contains the state machine for the UI, editor logic, and sync triggers.
- `schema.sql`: Source of truth for the D1 database.
- `src/app/admin/page.tsx`: The administrative dashboard.

## 🛠️ Key Workflows
1.  **Saving**: Triggered manually or by 30s autosave. Updates storage, indexer, and cloud.
2.  **Auth**: Managed via Bearer tokens. Note: `apiBase` in `handleRegister` is dynamically calculated to support both Web and Android (Capacitor) environments.
3.  **Wiki-linking**: Handled via `[[` or `/link`. Suggestions are derived from the local indexer.
4.  **Sharing (Form A)**: Document-level sharing via `functions/api/notes/share.ts`. Uses an inbox pattern where recipients must "Accept" notes.

## 🚩 Guidelines for Next Agent
- **Styles**: Established "high-contrast" Zinc/Blue palette.
- **Platform Handling**: When adding new API calls, ensure they use the dynamic `apiBase` logic to prevent Android connectivity failures.
- **Markdown Rendering**: `react-markdown` is used with `remark-gfm`. Wiki-links are rendered via a custom `p` component processor in `page.tsx`.

## ⏭️ Immediate Next Task
Implement **Form B Sharing (Live Share)**. This requires a presence engine to track active users on a note and handle real-time synchronization.
