# md.app

A premium, local-first Markdown note-taking application built for mobile, web, and desktop. Designed for speed, data ownership, and professional-grade collaboration.

## ✨ Core Features

### 🛡️ Governance & Security
- **Admin Portal**: A dedicated dashboard for managing users, updating passwords, enabling/disabling 2FA, and managing storage quotas.
- **End-to-End Encryption (E2EE)**: Per-vault client-side encryption using AES-256-GCM.
- **Force Password Reset**: Admins can mandate security updates for any account.

### 🤝 Advanced Sharing
- **Vault Sharing**: Collaborate at the vault level with granular roles (Owner, Editor, Viewer).
- **Document Sharing (Form A)**: Send specific notes directly to another user's "Shared with Me" inbox within the app.
- **Revision History**: Track and restore previous versions of notes from the cloud.

### ✍️ Professional Editor
- **Linking & Backlinks**: Support for `[[Wiki-links]]` with an intelligent suggestion menu for linking notes and folders.
- **Slash Commands**: Type `/` for formatting tools, `/template` to insert snippets, or `/link` to quickly link other notes.
- **Interactive Checklists**: Toggle task items (`- [ ]`) directly in the **Reading View**—automatically updates the source file with reliable line-aware synchronization.
- **Template System**: Configure custom templates in Settings to automate your recurring workflows.

### 🚀 Performance & Sync
- **Local-First Architecture**: Zero-latency access with background cloud sync.
- **Automated Parity**: v1.2.9 introduced `fullSyncFromCloud` ensuring your entire vault is indexed and available immediately after login.
- **Platform Optimized**: Native mobile builds feature optimized API connectivity and platform-aware storage (Capacitor Preferences) for maximum reliability.
- **Responsive Navigation**: Full feature parity on mobile via a modern sidebar overlay and gesture-friendly interface.

### 🛡️ Automated Security
- **CI/CD Security Scanning**: Integrated GitHub Actions for Gitleaks (secrets), Semgrep (SAST), and Trivy (vulnerabilities).
- **Hardened Codebase**: Strict typechecking and linting enforced on every push.

---

## ☁️ Cloud Sync Setup (S3/R2)

`md.app` works with any S3-compatible provider. We recommend **Cloudflare R2**.

### Configuration Format
Import your credentials in the Settings menu using this JSON structure:

```json
{
  "endpoint": "https://<account-id>.r2.cloudflarestorage.com",
  "accessKey": "id",
  "secretKey": "secret",
  "bucket": "notes"
}
```

---

## 💻 Technical Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js 16 (App Router) |
| **Backend** | Cloudflare Pages Functions (Workers) |
| **Database** | Cloudflare D1 (SQLite) |
| **Storage** | Cloudflare R2 (S3 API) |
| **Mobile** | Capacitor 8 (Android/iOS) |
| **Editor** | CodeMirror 6 |

---

## 📜 License
Copyright © 2026 Built Networks. All rights reserved.
MIT License.
