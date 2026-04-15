# md.app

**A Private, Self-Hosted, Markdown-based alternative to Notion & Evernote.**

md.app is a local-first, premium note-taking experience with end-to-end data ownership. It is designed for individuals, families, and teams who value privacy and control over their data. Notes sync seamlessly across devices via platform-managed Cloudflare R2 storage.

---

### Core Features

-   **📝 GFM Markdown Editor**: A beautiful and powerful editor for all your notes, with full support for GitHub Flavored Markdown, including interactive task lists.
-   **🚀 Local-First Architecture**: Your data lives on your device first. The app is incredibly fast and works entirely offline.
-   **☁️ Platform-Managed Cloud Sync**: Your notes sync securely across devices using the application's Cloudflare R2 storage. No setup required — you just sign in and go.
-   **🔐 End-to-End Encryption (E2EE)**: Enable vault-level E2EE to ensure that only you and your trusted members can read your notes. Data is encrypted at rest and in transit with keys only you hold.
-   **📂 Folder Organization**: Organize your notes with a simple and intuitive folder structure.
-   **📄 Customizable Templates**: Create and use templates for recurring note types like daily logs, meeting notes, or grocery lists.
-   **🤝 Vault Sharing**: Share specific vaults with family, friends, or team members with role-based access control (owner, editor, viewer).
-   **📱 Cross-Platform**: Available on the web and as native applications for Android and iOS.
-   **🔑 Secure Authentication**: Sign in with traditional email and password or with your Google account via OAuth 2.0.

### Tech Stack

-   **Frontend**: Next.js & React with TailwindCSS
-   **Mobile**: Capacitor to wrap the web app for native Android & iOS
-   **Backend**: Cloudflare Workers for API endpoints
-   **Database**: Cloudflare D1 for user and vault metadata
-   **Storage**: Cloudflare R2 (platform-managed)

### Getting Started

To get started with local development:

1.  Clone the repository.
2.  Install dependencies with `npm install`.
3.  Set up your Cloudflare R2/D1 environment and obtain the necessary credentials.
4.  Create a `.dev.vars` file in the root directory for local development with your Cloudflare environment variables.
5.  Run the development server with `npm run dev`.

### License

This project is proprietary and not available under an open-source license.
