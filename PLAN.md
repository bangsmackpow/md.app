# Premium md.app Roadmap

This document outlines the architectural evolution of `md.app` from a functional prototype to a professional-grade, local-first Markdown note-taking application.

## Core Vision
A "Premium" experience means **Instant, Reliable, and Platform-Agnostic**. The app should feel native on iOS/Android, performant on Web, and powerful on Desktop, with data ownership at its core.

---

## Phase 1: Storage Abstraction (The Foundation)
Currently, the UI is tightly coupled to `@capacitor/filesystem`. We need to decouple this to support Web and Desktop environments.

- [ ] **Define `StorageProvider` Interface**: Create a unified API for `read`, `write`, `list`, and `delete`.
- [ ] **Implement Adapters**:
    - **Mobile**: Capacitor Filesystem (Current logic).
    - **Web**: IndexedDB or Origin Private File System (OPFS).
    - **Desktop**: Node.js `fs` (for Electron/Tauri).
- [ ] **Dependency Injection**: Initialize the correct provider at runtime based on the platform.

## Phase 2: Local-First Data Engine
Relying on direct file reads for the UI is slow for large vaults. We need a metadata layer.

- [ ] **Local Metadata DB**: Use SQLite (via Capacitor SQLite) to index notes.
- [ ] **Indexing Logic**: Automatically scan `.md` files to extract:
    - Title (H1 or Filename)
    - Tags (`#tag`)
    - Created/Modified timestamps
    - Summary/Snippet
- [ ] **Global Search**: Implement fast, fuzzy search across the indexed metadata.

## Phase 3: Robust Sync (Conflict Resolution)
Move beyond "Last Write Wins" to prevent data loss across multiple devices.

- [ ] **Sync Engine**: Move S3/R2 logic to a background worker/service.
- [ ] **Conflict Detection**: Store ETags or hashes of remote files to detect when a local file and a remote file have both changed.
- [ ] **Resolution Strategy**: 
    - Implement "Latest Wins" with automatic "Conflict Copy" creation.
    - Status indicators (Syncing, Up to date, Conflict, Offline).

## Phase 4: The "Pro" Editor
Replace the standard HTML `<textarea>` with a specialized code editor engine.

- [ ] **CodeMirror 6 Integration**:
    - High-performance rendering of large files.
    - Markdown-specific syntax highlighting.
    - "Active Line" highlighting.
    - Smart indentation and list handling.
- [ ] **Enhanced Slash Menu**: Keyboard-navigable menu with more formatting options (Tables, Math/LaTeX, Code Blocks).
- [ ] **Bi-directional Linking**: Support `[[WikiLinks]]` for building a personal knowledge base.

## Phase 5: Design & UX Polish
Transition from "Standard UI" to "Premium Feel."

- [ ] **Typography First**: Fine-tune the prose styles for maximum readability (variable fonts, optimized line-heights).
- [ ] **Navigation Refactor**: Move from a simple "list vs editor" view to a modern Sidebar/Workspace layout for larger screens.
- [ ] **Haptic Feedback**: Add subtle haptics for mobile interactions (saving, deleting, opening menus).
- [ ] **Native Integration**: 
    - iOS/Android Home Screen Widgets.
    - Desktop System Tray / Menu Bar quick-capture.

---

## Technical Debt to Resolve
- **State Management**: Move from local `useState` in `page.tsx` to a more robust store (Zustand or Jotai) to handle complex sync and indexing states.
- **Error Boundaries**: Better handling of filesystem permissions and network failures.
- **Testing**: Implement unit tests for the Sync Engine and Storage Providers.
