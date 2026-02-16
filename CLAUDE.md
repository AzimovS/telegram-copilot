# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Telegram Copilot is a desktop Telegram client with AI-powered features for power users. It helps users process messages faster, avoid missing important conversations, manage contacts, and perform safe bulk communication.

## Tech Stack

- **Desktop**: Tauri v2 + React 19 + TypeScript + Vite
- **Telegram**: Grammers (pure Rust MTProto client)
- **AI**: Direct OpenAI API calls from Rust (gpt-4o-mini)
- **Styling**: Tailwind CSS v4 + shadcn/ui (new-york style)
- **State Management**: Zustand v5
- **Database**: SQLite (bundled via rusqlite)
- **Cache**: In-memory TTL cache

## Development Commands

```bash
# Frontend development (Vite dev server on port 1420)
npm run dev

# Build frontend
npm run build

# Run Tauri desktop app in development
npm run tauri dev

# Build desktop app for distribution
npm run tauri build
```

## Testing

```bash
# Unit tests (Vitest + React Testing Library)
npm test              # Watch mode
npm test -- --run     # Run once and exit

# E2E tests (Playwright — runs against Vite dev server with mocked Tauri IPC)
npm run test:e2e      # Run all E2E tests
npm run test:e2e:ui   # Debug with Playwright UI

# Rust tests
cd src-tauri && cargo test

# TypeScript type check
npx tsc --noEmit

# Run all checks before committing
npm test -- --run && npm run test:e2e && cd src-tauri && cargo check && cd .. && npx tsc --noEmit
```

## Architecture

### Two-Tier Structure

1. **Frontend** (`src/`) - React app running in Tauri webview
2. **Rust Backend** (`src-tauri/`) - Tauri commands + Telegram client + AI + SQLite

### Data Flow

```
React Components → Zustand Stores → Tauri IPC → Rust Commands → Grammers/SQLite/OpenAI
```

### Frontend Communication

- **Tauri IPC**: All operations go through `src/lib/tauri.ts` which wraps `@tauri-apps/api` invoke calls
- **Events**: Rust broadcasts real-time updates via Tauri events (e.g., `telegram://new-message`, `telegram://auth-state`)
- **Stores**: Zustand stores in `src/stores/` manage state (authStore, briefingStore, chatStore, contactStore, outreachStore, scopeStore, settingsStore, summaryStore, themeStore)

### Main Views

The app has 6 main views accessible from the header navigation, plus a persistent ChatPanel sidebar:
- Briefing (AI inbox), Summary, Chats, Contacts, Outreach, Offboard

## Key Directories

```
src/
├── components/ui/       # shadcn/ui primitives (don't modify directly)
├── components/*/        # Feature components organized by view
├── stores/              # Zustand state management
├── lib/tauri.ts         # IPC bridge to Rust backend
└── types/               # TypeScript type definitions

src-tauri/
├── src/ai/              # OpenAI client, prompts, types
├── src/cache.rs         # In-memory TTL cache for AI responses
├── src/commands/        # Tauri command handlers (auth, chats, contacts, scopes, outreach, ai)
├── src/db/              # SQLite operations
└── src/telegram/        # Grammers client wrapper
```

## Critical Constraints

- **Rate Limits**: Outreach features must maintain 30+ second delays between messages; handle FLOOD_WAIT errors gracefully
- **Scope System**: AI features only process chats within user-selected scopes (folders, chat types, or manual selection)
- **Local-First**: All data stays on device; OpenAI API calls are made directly from the Rust backend
- **Single App**: Everything runs in the Tauri app - no separate backend server needed

## Telegram Integration Notes

- Uses Grammers library (not TDLib) for Telegram MTProto protocol
- Session stored locally via grammers-session
- Auth flow: connect → send_phone_number → send_auth_code → send_password (if 2FA)
- Contact operations include local SQLite storage for tags/notes

## AI Integration

- Direct OpenAI API calls from Rust (`src-tauri/src/ai/client.rs`)
- Uses gpt-4o-mini model
- Features: Briefings, Summaries, Draft generation
- Responses cached in-memory with TTL (`src-tauri/src/cache.rs`)

## Git Commits

Do not add Co-Authored-By lines to commit messages.

## Environment Variables

Create a `.env` file in the project root with:
- `TELEGRAM_API_ID` - From https://my.telegram.org
- `TELEGRAM_API_HASH` - From https://my.telegram.org
- `OPENAI_API_KEY` - For AI features (optional, AI features disabled without it)
