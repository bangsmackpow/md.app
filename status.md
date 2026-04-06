# md.app Project Status

## 🚀 Recent Accomplishments
- **Admin Portal (v1.1.57-61)**: Complete administrative suite for user governance, password management, and storage quotas.
- **Interactive Checklists (v1.1.62-64, v1.3.1)**: Real-time toggling of tasks in Reading View with source-file synchronization; fixed toggle logic for reliability.
- **Templates System (v1.1.65)**: Added `/template` command and settings-based template management.
- **Wiki-links (v1.1.66-68)**: Note linking with `[[` suggestions, `/link` command, and clickable navigation in Reading View.
- **Document Sharing (Form A) (v1.1.67)**: Inbox-style document sharing between users.
- **Android Connectivity (v1.1.68, v1.2.8)**: Resolved API base URL issues for native Android environments; centralized logic in `src/lib/api.ts`.
- **iOS Platform (v1.1.81)**: Scaffolded native iOS project and implemented GitHub Actions build workflow.
- **End-to-End Encryption (E2EE) (v1.1.71)**: AES-256-GCM client-side encryption for per-vault security.
- **CI/CD Security (v1.1.72)**: Integrated Gitleaks, Semgrep, Trivy, and security hygiene workflows.
- **Platform-Aware Indexing (v1.2.8)**: Refactored `JsonIndexProvider` to use Capacitor `Preferences` for reliable mobile storage.
- **Cloud Sync Automation (v1.2.9)**: Implemented `fullSyncFromCloud` on login and vault switch to ensure mobile parity.
- **Mobile UI Overhaul (v1.3.2)**: Restored mobile-optimized header and sidebar navigation for complete feature access on small screens.

## 🏗️ Current Work
- **Form B Sharing (Live Share)**: Real-time collaborative editing using a presence engine. (Not yet started).
- **Backlinks Panel**: A UI component to show what other notes link to the current note.

## 📋 Known Issues / Gaps
- **Editor Continuation**: Basic Enter key behavior is standard; advanced list/markup continuation (CodeMirror commands) is being refined for mobile keyboards.
- **Live Sync Conflicts**: Currently uses a "last write wins" strategy for the cloud; Form B will address this.

## 📅 Roadmap
1.  **Form B (Live Share)**: WebSocket-based or polling-based presence and sync.
2.  **Web Clipper**: Browser extension for saving content.
3.  **Google Play Store Submission**: Sign production App Bundles (.aab) and complete store listing.
