# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Telegram Copilot is a desktop Telegram client with AI-powered features for power users. It helps users process messages faster, avoid missing important conversations, manage contacts, and perform safe bulk communication.

## Tech Stack

- **Desktop**: Tauri v2 + React 19 + TypeScript + Vite
- **Telegram**: Grammers (pure Rust MTProto client)
- **Styling**: Tailwind CSS v4 + shadcn/ui (new-york style)
- **State Management**: Zustand v5
- **AI Backend**: FastAPI (Python) + Redis + OpenAI

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

# Backend (from backend/ directory)
cd backend && uvicorn app.main:app --reload --port 8000

# Backend with Docker
cd backend && docker-compose up
```

## Architecture

### Three-Tier Structure

1. **Frontend** (`src/`) - React app running in Tauri webview
2. **Rust Backend** (`src-tauri/`) - Tauri commands + Telegram client via Grammers
3. **AI Backend** (`backend/`) - FastAPI service for LLM operations

### Data Flow

```
React Components → Zustand Stores → Tauri IPC → Rust Commands → Grammers/SQLite
                                              → HTTP → FastAPI (AI operations)
```

### Frontend Communication

- **Tauri IPC**: All Telegram operations go through `src/lib/tauri.ts` which wraps `@tauri-apps/api` invoke calls
- **Events**: Rust broadcasts real-time updates via Tauri events (e.g., `telegram://new-message`, `telegram://auth-state`)
- **Stores**: Zustand stores in `src/stores/` manage state (authStore, chatStore, contactStore, outreachStore, scopeStore, themeStore)

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
├── src/commands/        # Tauri command handlers (auth, chats, contacts, scopes, outreach)
├── src/telegram/        # Grammers client wrapper
└── src/db/              # SQLite operations

backend/
├── app/routers/         # FastAPI routes (briefing, summary, draft)
└── app/services/        # AI and cache services
```

## Critical Constraints

- **Rate Limits**: Outreach features must maintain 60+ second delays between messages; handle FLOOD_WAIT errors gracefully
- **Scope System**: AI features only process chats within user-selected scopes (folders, chat types, or manual selection)
- **Local-First**: Telegram data stays on device; only scoped chat content goes to AI backend
- **No LLM Keys in Client**: All AI calls route through the Python backend

## Telegram Integration Notes

- Uses Grammers library (not TDLib) for Telegram MTProto protocol
- Session stored locally via grammers-session
- Auth flow: connect → send_phone_number → send_auth_code → send_password (if 2FA)
- Contact operations include local SQLite storage for tags/notes

## Git Commits

Do not add Co-Authored-By lines to commit messages.

## Environment Variables

Backend requires `.env` with:
- `OPENAI_API_KEY` - For GPT-4o mini
- `REDIS_URL` - Cache connection

Tauri app requires Telegram API credentials in `src-tauri/.env`:
- `TELEGRAM_API_ID`
- `TELEGRAM_API_HASH`
