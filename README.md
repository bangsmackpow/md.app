# Next.js Starter Template

A minimal, production-ready Next.js 16 starter template optimized for AI-assisted development.

## Original Prompt

> Create a minimal Next.js starter template designed for AI-assisted development. It should provide a clean foundation that can be extended to build any type of web application through interaction with an AI assistant.
>
> **Requirements:**
> - Modern Next.js 16 setup with App Router
> - TypeScript for type safety
> - Tailwind CSS 4 for styling
> - ESLint for code quality
> - Clean, minimal starting structure
> - Bun as package manager
>
> **Nice to Have:**
> - Recipe system for common additions (database, auth)
> - Memory bank for AI context persistence
> - Clear development guidelines

## Architecture & Approach

### Design Philosophy

This template follows a **minimal-by-default** philosophy:
- Start with just enough to build
- Add features only when needed
- Trust the AI to extend based on requirements

### Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16.x | React framework with App Router |
| React | 19.x | UI library |
| TypeScript | 5.9.x | Type-safe JavaScript |
| Tailwind CSS | 4.x | Utility-first CSS |
| Bun | Latest | Package manager & runtime |

### Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout + metadata
│   ├── page.tsx            # Home page
│   ├── globals.css         # Tailwind imports + global styles
│   └── favicon.ico         # Site icon
└── (expand as needed)
    ├── components/         # React components (add when needed)
    ├── lib/                # Utilities and helpers
    └── db/                 # Database files (add via recipe)
```

### Key Architectural Patterns

1. **App Router**: Uses Next.js file-based routing (`src/app/`)

2. **Server Components by Default**: All components are Server Components unless marked with `"use client"`

3. **Component Organization** (when expanding):
   ```
   src/components/
   ├── ui/           # Reusable UI components
   ├── layout/       # Layout components (Header, Footer)
   ├── sections/     # Page sections (Hero, Features)
   └── forms/        # Form components
   ```

4. **Styling**: Tailwind CSS 4 with utility classes directly on elements

### Memory Bank System

The template includes a memory bank system (`.kilocode/rules/memory-bank/`) that provides persistent context for AI assistants:

- `brief.md` - Project goals and requirements
- `product.md` - User flows and UX goals
- `architecture.md` - Code patterns and conventions
- `tech.md` - Tech stack and dependencies
- `context.md` - Current state and recent changes

### Recipe System

Recipes provide step-by-step guides for adding common features:

| Recipe | File | Use Case |
|--------|------|----------|
| Add Database | `.kilocode/recipes/add-database.md` | Data persistence with Drizzle + SQLite |

## Getting Started

### Prerequisites

- Bun installed: `curl -fsSL https://bun.sh/install | bash`

### Installation

```bash
bun install
```

### Development

```bash
bun dev          # Start dev server (http://localhost:3000)
bun build        # Production build
bun start        # Start production server
bun lint         # Run ESLint
bun typecheck    # Run TypeScript type checking
```

## Extending the Template

### Adding a New Page

Create a file at `src/app/[route]/page.tsx`:

```tsx
export default function NewPage() {
  return <div>New page content</div>;
}
```

### Adding Components

Create `src/components/` directory and add components:

```tsx
// src/components/ui/Button.tsx
export function Button({ children }: { children: React.ReactNode }) {
  return <button className="px-4 py-2 bg-blue-600 text-white rounded">{children}</button>;
}
```

### Adding API Routes

Create `src/app/api/[route]/route.ts`:

```tsx
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ message: "Hello" });
}
```

### Adding a Database

Follow `.kilocode/recipes/add-database.md` to add Drizzle + SQLite.

## Deployment

The template produces server-rendered pages by default. Deploy to any platform that supports Next.js (Vercel, Netlify, Docker, etc.).

## License

MIT
