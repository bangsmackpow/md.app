# md.app

A premium, local-first Markdown note-taking application built for mobile, web, and desktop. Designed by Built Networks for speed, data ownership, and a professional editing experience.

## ✨ Premium Features

### 🚀 Performance & Storage
- **Local-First Architecture**: Your notes are stored on your device first. Lightning-fast access with zero latency.
- **Cross-Platform Sync**: Built-in support for S3-compatible storage (Cloudflare R2, AWS S3, MinIO) to keep your devices in sync.
- **Android Persistence**: Configured to use external storage on Android, ensuring your `.md` files survive even if the app is uninstalled.
- **Unified API**: Seamlessly switches between Capacitor Filesystem (Mobile) and LocalStorage (Web).

### ✍️ Professional Editor
- **CodeMirror 6 Engine**: A high-performance, modular editor replacing standard textareas.
- **Searchable Slash Menu**: Type `/` to open a command palette with 13+ formatting options (Checklists, Headings, Code Blocks, etc.).
- **Interactive Checklists**: Toggle task items (`- [ ]`) directly in the **Preview Mode** with a single click—automatically updates the source file and syncs to cloud.
- **Metadata Indexing**: Background engine that automatically extracts titles, `#tags`, and snippets for a rich, searchable list view.

### 🛠️ Effortless Configuration
- **Credential Import**: Skip manual typing. Import your S3/R2 credentials instantly via a simple JSON file.
- **Auto-Update Engine**: Automatically polls the GitHub Releases API. Receive a notification banner the moment a new version is ready.

---

## ☁️ Cloud Sync Setup (S3/R2)

`md.app` is designed to work with any S3-compatible provider. We recommend **Cloudflare R2** for its speed and zero-egress fees.

### Configuration Format
Create a file named `s3-config.json` with the following structure to import your credentials in the Settings menu:

```json
{
  "endpoint": "https://<your-account-id>.r2.cloudflarestorage.com",
  "accessKey": "your-access-key-id",
  "secretKey": "your-secret-key",
  "bucket": "your-bucket-name"
}
```

---

## 🔄 Update Process

1. **Detection**: The app checks the GitHub repository for tags newer than the current version.
2. **Notification**: A blue "Update Available" banner appears at the top of your notes list and a dot appears on the Settings icon.
3. **Installation**: Clicking the banner opens the GitHub Release page where you can download the latest `.apk` or view the web deployment.

---

## 💻 Technical Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript 5.9 |
| **Styling** | Tailwind CSS 4 |
| **Mobile** | Capacitor 8 |
| **Editor** | CodeMirror 6 |
| **Markdown** | React Markdown + remark-gfm |
| **Cloud** | AWS SDK (S3 Client) |

---

## 🛠️ Development

### Prerequisites
- [Bun](https://bun.sh) (Package Manager)
- Android Studio (for Mobile builds)

### Commands
```bash
bun install          # Install dependencies
bun dev              # Local web development
bun run build        # Production build
bun lint             # Code quality check
```

### Deployment (Android)
```bash
bun run build        # Build Next.js
npx cap copy         # Copy web assets to Android
npx cap open android # Open in Android Studio
```

---

## 📜 License
Copyright © 2026 Built Networks. All rights reserved.
MIT License (see source).
