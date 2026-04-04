# Agent Handoff: md.app

Welcome, agent. This is a local-first Markdown application built with Next.js and Capacitor, running on Cloudflare (D1, R2, Pages).

## 🧩 Architectural Overview
- **Storage**: `src/lib/storage` handles abstraction between Capacitor Filesystem (Android) and LocalStorage (Web).
- **Indexing**: `src/lib/indexer` handles note metadata and full-text indexing (stored in LocalStorage).
- **Sync**: `src/lib/sync` handles S3/R2 communication.
- **Database**: Cloudflare D1 handles users, sessions, vaults, audit logs, and shared note metadata.
- **Functions**: `functions/api/` contains the backend Workers.

## 🔑 Important Files
- `src/app/page.tsx`: Primary application entry point.
- `schema.sql`: Source of truth for D1 database.
- `.github/workflows/security-scan.yml`: CI/CD security pipeline.
- `src/lib/crypto.ts`: E2EE logic using Web Crypto API.

## 🛠️ Key Workflows
1.  **Saving**: Updates storage, indexer, and cloud. Handles E2EE if enabled.
2.  **Auth**: Bearer tokens with dynamic `apiBase` for Android support.
3.  **Sharing (Form A)**: Inbox-style document transfer.
4.  **E2EE**: Per-vault encryption using AES-256-GCM. Keys are derived from passphrases and NEVER stored.

## 🚩 Guidelines for Next Agent
- **Security**: Repo is monitored by Gitleaks, Semgrep, and Trivy. Ensure new code passes linting and typechecking.
- **Styles**: Established "high-contrast" Zinc/Blue palette.
- **Platform Handling**: Maintain the dynamic `apiBase` logic in `page.tsx` for Android.
- **Markdown Rendering**: Wiki-links are rendered via a custom `p` processor in `page.tsx`.

## ⏭️ Immediate Next Task
Implement **Form B Sharing (Live Share)**. This requires a presence engine to track active users on a note and handle real-time synchronization.
