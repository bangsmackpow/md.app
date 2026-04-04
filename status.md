# md.app Project Status

## 🚀 Recent Accomplishments
- **Admin Portal (v1.1.57-61)**: Complete administrative suite for user governance, password management, and storage quotas.
- **Interactive Checklists (v1.1.62-64)**: Real-time toggling of tasks in Reading View with source-file synchronization.
- **Templates System (v1.1.65)**: Added `/template` command and settings-based template management.
- **Wiki-links (v1.1.66-68)**: Note linking with `[[` suggestions, `/link` command, and clickable navigation in Reading View.
- **Document Sharing (Form A) (v1.1.67)**: Inbox-style document sharing between users.
- **Android Connectivity (v1.1.68)**: Resolved API base URL issues for native Android environments and established file associations.

## 🏗️ Current Work
- **Form B Sharing (Live Share)**: Real-time collaborative editing using a presence engine. (Not yet started).
- **Backlinks Panel**: A UI component to show what other notes link to the current note.

## 📋 Known Issues / Gaps
- **Full-Text Search**: Requires a "Manual Sync" or opening/saving a note to index old content into the new searchable format.
- **Live Sync Conflicts**: Currently uses a "last write wins" strategy for the cloud; Form B will address this.

## 📅 Roadmap
1.  **Form B (Live Share)**: WebSocket-based or polling-based presence and sync.
2.  **Web Clipper**: Browser extension for saving content.
3.  **Encrypted Vaults**: End-to-end encryption for specific vaults.
