# Product Requirements Document (PRD)

## Product name (working)

**Telegram Copilot**
(Internal codename is fine; name not required for PRD)

---

## 1. Overview

### 1.1 Purpose

Build a **desktop Telegram client** for ~100 users that helps them:

* process messages faster
* avoid missing important conversations
* manage contacts intelligently
* safely perform bulk communication
* analyze conversations over time using AI

The product must be **fast, reliable, privacy-respecting**, and **Telegram-compliant**, while remaining **closed-source**.

---

### 1.2 Target users

* Founders, operators, investors
* Developers and community managers
* Power Telegram users with:

  * many chats
  * large contact lists
  * frequent outreach
  * high cognitive load

---

### 1.3 Key differentiator

> **User-controlled AI assistance over Telegram conversations**, with strict rate-limit safety, caching, and privacy boundaries.

---

## 2. Goals & Non-goals

### 2.1 Goals

* Reduce inbox overload
* Highlight chats that **need response**
* Enable safe bulk messaging without bans
* Provide conversation insights over time
* Keep Telegram data **local-first**
* Avoid Telegram rate-limit violations

### 2.2 Non-goals

* Mobile client (desktop only)
* Bot-based automation
* Full CRM replacement
* Server-side Telegram message storage

---

## 3. Supported platforms

* Windows
* macOS
* Linux

---

## 4. User flows (high level)

1. User installs desktop app
2. Logs in with Telegram (phone + code)
3. Selects which chats should be included in AI features
4. Uses:

   * Smart Briefing
   * Summaries
   * Quick replies
   * Contact management
   * Bulk outreach
   * Offboarding
5. App auto-updates silently when new versions are released

---

## 5. Chat inclusion & scope control (NEW – IMPORTANT)

### 5.1 Requirement

**User must explicitly control which chats are included in AI features and analytics.**

No AI processing should occur outside the selected scope.

---

### 5.2 Chat inclusion methods

Users can choose **one or more** of the following:

#### A) Telegram folders (dialog filters)

* Example: “Work”, “Unread”, “Clients”
* System uses Telegram’s dialog filters
* Changes to folders automatically reflect in scope

#### B) Chat type selection

* Personal DMs only
* Groups only
* Channels only
* Bots (optional)
* Muted chats (include/exclude)

#### C) Manual chat selection

* Checkbox-based chat picker
* Searchable list
* Suitable for “VIP-only” workflows

---

### 5.3 Scope profiles

Users can save **scope presets**, e.g.:

* “Work Focus”
* “Investors”
* “Community Management”

Each feature (Smart Briefing, Summary, Outreach) must:

* either use the **default scope**
* or allow selecting a scope override

---

### 5.4 Enforcement rules

* Only chats in scope:

  * are sent to AI backend
  * appear in summaries
  * appear in briefing inbox
* Chat scope changes invalidate related AI caches

---

## 6. Functional requirements

---

### 6.1 Account & session

* Telegram login via phone number
* 2FA password support
* Session persists across restarts
* Logout options:

  * logout only
  * logout + wipe all local data

---

### 6.2 Core messaging

* Chat list (filtered by selected scope where applicable)
* Chat panel:

  * message history pagination
  * send messages
  * read/unread sync
* Scheduled messages:

  * date + time + timezone
  * persistent across restarts

---

### 6.3 Smart Briefing (AI inbox)

#### Description

AI-powered overview of **unread chats within selected scope**.

#### Inputs

* Unread chats only
* Last N messages per chat (configurable)
* Metadata: timestamps, unread count

#### Outputs

* Category:

  * urgent
  * needs_reply
  * fyi
* Short summary
* Suggested reply
* Priority ordering

#### Caching

* 1-hour cache per:

  * chat_id
  * scope
  * last_message_id
  * model
  * prompt_version

#### UX

* Inbox grouped by category
* “Regenerate” button with warning
* Indicator when data is cached vs fresh

---

### 6.4 Conversation Summary & Analysis

#### Time ranges

* Week
* Month
* 3 Months

#### Filters

* All chats
* DMs only
* Groups only
* Channels only
* Needs Response Only

#### Outputs

* Summary text
* Key points
* Action items
* Sentiment:

  * positive
  * neutral
  * negative
  * urgent

#### Pagination

* 10 chats per page

#### Caching

* 6-hour cache per:

  * chat_id
  * scope
  * range
  * filters

---

### 6.5 Contact management

#### Features

* View contacts (1000+)
* Tags (custom, multi-tag)
* Notes (local-only)
* Sorting:

  * Recent
  * Alphabetical
  * Unread
* Search
* “Days since last contact”
* Highlight “never contacted”

#### Bulk operations

* Tag assign/remove
* Delete contacts (Telegram + local cleanup)

#### Caching

* Contact list cached for 7 days
* Manual refresh with backoff

---

### 6.6 Bulk outreach

#### Selection

* Contacts by tag
* Manual selection

#### Messaging

* Templates with `{{name}}`
* Per-recipient preview
* Send now or schedule

#### Rate-limit protection

* Minimum 60 seconds between messages
* Automatic pause on FLOOD_WAIT
* Resume when safe

#### Tracking

* Per-recipient status:

  * queued
  * sent
  * failed
  * rate-limited

---

### 6.7 Offboarding

#### Features

* Find shared groups/channels with a contact
* Show:

  * group type
  * admin permissions
* Bulk remove where allowed

#### Rate-limit constraints

* Max 5 lookups/day/user
* Cached results reused
* Cache TTL configurable (recommended: 7–30 days)

---

## 7. AI requirements

### 7.1 Models

* Default: **GPT-4o mini**
* Long context (optional): **Gemini Flash**

### 7.2 Architecture

* AI runs in backend service
* Desktop never stores LLM API keys
* Strict JSON output schemas

### 7.3 Privacy

* Only scoped chats are sent
* No full contact lists by default
* No long-term server-side message storage

---

## 8. Non-functional requirements

### 8.1 Performance

* Instant UI render from cached data
* Virtualized chat lists
* Background processing for AI

### 8.2 Reliability

* TDLib handles networking & updates
* Background jobs survive restarts
* Clear error states

### 8.3 Security

* Local-first Telegram data
* Signed auto-updates
* No secrets in client
* Optional local DB encryption

---

## 9. Technical stack (approved)

### Desktop

* **Tauri v2**
* **React + TypeScript + Vite**
* Tailwind CSS

### Telegram

* **TDLib** (via Rust backend)

### Local storage

* SQLite (app metadata)
* TDLib-managed database (Telegram data)

### AI backend

* FastAPI (Python)
* Redis (cache + coordination)
* Queue (Celery/RQ)
* GPT-4o mini / Gemini Flash

---

## 10. MVP definition

### MVP includes

* Telegram login
* Chat scope selection (folders + chat types)
* Smart Briefing
* Contact tags + notes
* Bulk outreach (rate-limited)
* Signed auto-updates

### Post-MVP

* Long-term summaries
* Sentiment analytics polish
* Advanced offboarding
* Multi-account support

---

## 11. Success metrics

* Reduction in unread messages
* % of chats categorized as “needs reply” answered within 24h
* Zero Telegram bans / flood-lock incidents
* AI cost per user within target budget

---

## 12. Open questions (for later)

* Should scopes be global or per-feature?
* Should users be warned when adding large scopes?
* Do we allow exporting summaries?

---

If you want, next I can:

* turn this into a **technical design doc**
* define **API contracts** (desktop ↔ AI backend)
* design **UX wireframes**
* produce a **milestone-based development plan**

Just tell me what you want next.
