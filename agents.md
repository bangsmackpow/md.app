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
- `schema.sql`: Source of truth for the D1 database. When updating, remember to provide users with `ALTER TABLE` instructions for existing deployments.
- `src/app/admin/page.tsx`: The administrative dashboard.

## 🛠️ Key Workflows
1.  **Saving**: Triggered manually or by 30s autosave. Updates storage, indexer, and cloud.
2.  **Auth**: Managed via Bearer tokens stored in `@capacitor/preferences`. `is_admin` and `force_password` flags are checked on login.
3.  **Sharing (Form A)**: Users send notes to recipient emails. The recipient sees these in their sidebar under "Shared with Me" and can "Accept" them into their own vault.

## 🚩 Guidelines for Next Agent
- **Styles**: Use the established "high-contrast" Zinc/Blue palette.
- **Mobile First**: Ensure all UI elements are touch-friendly and handle safe-area insets.
- **Performance**: Keep the editor lightweight. Use `useCallback` and `useMemo` extensively in `page.tsx` to prevent unnecessary re-renders of the CodeMirror instance.
- **Security**: Never expose D1/R2 keys in the frontend. All sensitive ops must go through `functions/api/`.

## ⏭️ Immediate Next Task
Implement **Form B Sharing (Live Share)**. This requires a presence engine (likely polling `functions/api/live/presence.ts` for now) to track active users on a note and handle real-time content merges or "Active User" indicators.
