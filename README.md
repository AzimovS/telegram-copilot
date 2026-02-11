# Telegram Copilot Desktop

A desktop Telegram client with AI-powered features for power users, built with Tauri + React + TypeScript.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://www.rust-lang.org/tools/install)
- [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/)

## Setup

1. Clone the repo and install dependencies:

```bash
git clone https://github.com/AzimovS/telegram-copilot.git
cd telegram-copilot
npm install
```

2. Get Telegram API credentials:
   - Go to https://my.telegram.org and log in with your phone number
   - Click **API development tools**
   - Create a new application (fill in app title and short name — platform doesn't matter)
   - Copy your **API ID** and **API Hash**

3. Create a `.env` file and fill in your credentials:

```bash
cp .env.example .env
```

```
TELEGRAM_API_ID=your_api_id
TELEGRAM_API_HASH=your_api_hash
OPENAI_API_KEY=sk-your-openai-key   # optional, needed for AI features
```

## Running

```bash
npm run tauri dev
```

## Building

```bash
npm run tauri build
```

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
