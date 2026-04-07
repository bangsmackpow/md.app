# AI Agent Instructions for md.app

This document provides high-level context for AI agents working on the `md.app` codebase.

## 🎯 Project Goal

The primary goal of `md.app` is to be a **private, self-hosted, Markdown-based alternative to Notion and Evernote**. It is designed for users who prioritize data ownership, privacy, and a fast, local-first experience.

## 🏛️ Core Architectural Pillars

1.  **Local-First**: The application must function perfectly offline. All data is stored on the user's device first using browser/native storage. The UI should be optimistic and feel instantaneous.
2.  **Bring Your Own Cloud (BYOC)**: Users must be able to sync their data to their own S3-compatible object storage (Cloudflare R2, AWS S3, MinIO, etc.). The application should not rely on a centralized, proprietary database for user note content.
3.  **End-to-End Encryption (E2EE)**: User data must be private. Vaults can be encrypted on the client-side with a user-provided passphrase. The server should never have access to the unencrypted content of an E2EE vault.
4.  **Cross-Platform**: The application should provide a consistent experience across the web, Android, and iOS. This is achieved by using a web-native stack (Next.js) wrapped with Capacitor for mobile.
5.  **Standard Formats**: All user content is stored as plain Markdown files (`.md`). This prevents data lock-in and allows users to easily access their notes outside of the app.

## 🧑‍💻 Agent Directives

-   **Prioritize Privacy and Security**: Never introduce code that could compromise user data or the E2EE model. When handling authentication or data, always err on the side of caution.
-   **Maintain the Local-First Model**: Do not introduce features that require a constant internet connection. The app's core functionality must work offline.
-   **Respect the BYOC Principle**: Do not build features that assume or require a centralized data store for note content. The user's S3 bucket is the source of truth. Metadata (like user accounts or vault memberships) is stored in a central D1 database, but the note content itself is not.
-   **Adhere to Existing Patterns**: Follow the existing coding style, component structure, and state management patterns (`useState`, `useCallback`, `useMemo`). The main application logic is centralized in `src/app/page.tsx`. Backend API logic is in the `functions/` directory.
-   **Keep it Simple**: The core appeal of the app is its simplicity and focus on the writing experience. Avoid adding unnecessary complexity or features that deviate from the core mission.
