# Summary View - Complete Specification

## Overview

The Summary view provides deep conversation analysis over time periods (Week/Month/3 Months). It fetches full message history for each chat and uses AI to generate comprehensive summaries with key points, action items, and sentiment analysis.

---

## Layout Structure

### Visual Hierarchy
```
┌─────────────────────────────────────────────────────────────┐
│ Summary View Container                                       │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Header Section                                           │ │
│ │ ┌──────────────────┬──────────────────────────────────┐ │ │
│ │ │ Title: "📊 Summary"│ Filters (Right-aligned)        │ │ │
│ │ │                  │ - Type Filter Dropdown          │ │ │
│ │ │                  │ - Days Filter Dropdown          │ │ │
│ │ │                  │ - Needs Response Checkbox        │ │ │
│ │ │                  │ - Cache Badge (if cached)        │ │ │
│ │ │                  │ - Refresh Button                 │ │ │
│ │ └──────────────────┴──────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Stats Bar (Horizontal, 3 equal-width columns)            │ │
│ │ ┌──────────────┬──────────────┬──────────────┐         │ │
│ │ │ Active Chats│ Need Response│ Loaded       │         │ │
│ │ │ (Large #)   │ (Large #, red)│ (Large #)   │         │ │
│ │ │ (Small label)│ (Small label)│ (Small label)│         │ │
│ │ └──────────────┴──────────────┴──────────────┘         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Summary Cards (Vertical Stack)                           │ │
│ │ ┌─────────────────────────────────────────────────────┐ │ │
│ │ │ SummaryCard Component                               │ │ │
│ │ │ (See SummaryCard spec below)                        │ │ │
│ │ └─────────────────────────────────────────────────────┘ │ │
│ │ ... (10 cards per page, paginated)                     │ │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Load More Button (Conditional - if more available)       │ │
│ │ "📥 Load More (X remaining)"                           │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Empty State (Conditional - no chats found)              │ │
│ │ "No chats found for this time period"                   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Loading State (Conditional - during initial load)        │ │
│ │ - Spinner (centered, 40px)                              │ │
│ │ - Text: "📊 Generating summaries..."                    │ │
│ │ - Hint: "Loading first 10 chats..."                    │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## User Interactions & Behaviors

### 1. Initial Load

**Trigger**: User navigates to Summary view

**Sequence**:
1. Component mounts
2. State initialized with defaults
3. `loading = true`
4. GET request to `/summary?filter_type=all&days=7&needs_response_only=false&offset=0&limit=10`
5. If cache exists and valid:
   - Returns cached summaries immediately
   - `cached: true` in response
6. If no cache or expired:
   - Fetches dialogs from Telegram
   - Filters by type and date
   - For each chat: Fetches messages, sends to AI
   - Returns fresh summaries
   - `cached: false` in response
7. `loading = false`
8. Renders summary cards

**Loading State**:
- Shows centered spinner (40px)
- Text: "📊 Generating summaries..."
- Hint: "Loading first 10 chats..."
- Blocks all content

### 2. Filter Changes

**Trigger**: User changes any filter (type, days, or needs_response checkbox)

**Sequence**:
1. Filter state updates
2. `useEffect` triggers (dependency on filters)
3. `summaries` array cleared
4. `loading = true`
5. GET request with new filters, `offset=0`
6. Fresh data fetched (cache key different, so new cache)
7. `loading = false`
8. New summaries displayed

**Visual Feedback**:
- Loading screen shown during fetch
- All filters remain visible and functional
- Cache badge disappears (if was showing)

### 3. Load More Action

**Trigger**: User clicks "📥 Load More" button

**Sequence**:
1. Button click handler calls `loadMore()`
2. Validates: `!loadingMore && hasMore`
3. Calls `load(summaries.length)` (current count as offset)
4. `loadingMore = true`
5. Button shows "⏳ Loading..." and becomes disabled
6. GET request with same filters, new offset
7. On success:
   - New summaries appended to existing array
   - `hasMore` updated based on response
   - Stats updated
8. `loadingMore = false`
9. Button re-enabled or hidden (if no more)

**Visual Feedback**:
- Button shows loading state
- New cards appear below existing ones
- Smooth scroll (browser default)
- Button text updates with remaining count

### 4. Refresh Action

**Trigger**: User clicks "🔄 Refresh" button

**Sequence**:
1. Button click handler calls `load(0)`
2. `loading = true` (shows loading screen)
3. GET request with current filters, `offset=0`
4. Forces fresh fetch (bypasses cache if exists)
5. Updates `summaries` with fresh data
6. `loading = false`
7. UI updates

**Visual Feedback**:
- Loading screen shown
- Cache badge disappears
- All summaries refreshed

### 5. Opening Chat from Summary

**Trigger**: User clicks anywhere on summary card

**Sequence**:
1. Card click handler calls `onOpenChat(chat_id, chat_name)`
2. Parent component sets `activeChat = {id: chat_id, name: chat_name}`
3. Chat panel slides in from right (400px width)
4. Main content shifts left
5. Chat panel loads messages and generates draft

**State Persistence**:
- Summary view state remains unchanged
- User can return to summary, cards still visible
- Chat panel can be closed independently

---

## Edge Cases & Error Handling

### 1. No Chats in Time Period

**Condition**: No dialogs have messages within selected time range

**Behavior**:
- Backend returns empty `summaries` array
- Stats: `total: 0`, `needs_response: 0`, `loaded: 0`
- Renders empty state: "No chats found for this time period"

### 2. API Error During Load

**Condition**: Network error or 500 error from `/summary`

**Behavior**:
- Error logged to console
- `summaries` remains empty or previous value
- `loading = false`
- User sees empty state or previous data
- No error message shown to user

### 3. AI Analysis Failure

**Condition**: Claude API fails or returns invalid JSON for a chat

**Behavior**:
- Backend: `summarize_chat_messages` returns default:
  ```python
  {"summary": "Could not generate summary", "needs_response": False, "key_points": []}
  ```
- Chat still included in results with default summary
- No error shown to user
- Other chats continue processing

### 4. Empty Messages in Time Period

**Condition**: Chat has no messages within selected time range

**Behavior**:
- Backend: `messages` array is empty
- AI returns: `{"summary": "No messages in this period", ...}`
- Chat included with "No messages" summary
- `total_messages: 0`, `my_messages: 0`

### 5. Very Long Message History

**Condition**: Chat has 100+ messages in time period

**Behavior**:
- Backend: Fetches up to 100 messages (limit)
- AI: Only sees first 50 messages (truncated)
- Messages beyond 50 not analyzed
- Summary based on most recent 50 messages

### 6. Cache File Corruption

**Condition**: Cache file exists but JSON is invalid

**Behavior**:
- Backend: `load_json_cache` catches exception, returns `None`
- Cache treated as invalid
- Fresh data fetched
- No error shown

### 7. Pagination Edge Cases

**Condition**: User clicks "Load More" multiple times quickly

**Behavior**:
- Each click triggers new request
- `loadingMore` prevents duplicate requests
- Last response wins (updates state)
- May result in duplicate summaries if timing is off

**Condition**: Cache has 15 items, user loads page 2 (offset=10)

**Behavior**:
- Returns items 10-15 from cache
- `has_more: false` (no more in cache)
- Button hidden
- If more exist in source, won't be shown until refresh

### 8. Filter Change During Load

**Condition**: User changes filter while initial load is in progress

**Behavior**:
- `useEffect` triggers, clears summaries
- New request sent with new filters
- Previous request may complete but will be ignored
- New data replaces old

### 9. Missing Chat Name

**Condition**: `dialog.name` is `null` or empty

**Behavior**:
- Backend: Sets `chat_name: "Unknown"`
- Frontend: Displays "Unknown" in card

### 10. Sentiment Values

**Condition**: AI returns unexpected sentiment value

**Behavior**:
- Frontend: `getSentimentColor` defaults to gray for unknown values
- Displays sentiment as-is (capitalized)
- No error, graceful degradation

---

## Data Flow Diagram

```
User Action
    │
    ├─> Navigate to Summary
    │   └─> Component Mount
    │       └─> load(0)
    │           └─> GET /summary?filter_type=all&days=7&offset=0&limit=10
    │               ├─> Cache Hit? ──Yes──> Return Cached Page
    │               └─> Cache Miss? ─No──> Fetch 200 Dialogs
    │                                       ├─> Filter by Type & Date
    │                                       ├─> Paginate (offset:limit)
    │                                       ├─> For Each Chat (10):
    │                                       │   ├─> Fetch 100 Messages
    │                                       │   ├─> Filter by Date
    │                                       │   └─> AI Analysis (50 msgs)
    │                                       ├─> Filter by needs_response
    │                                       ├─> Sort (needs_response first)
    │                                       └─> Save Cache (if offset=0)
    │
    ├─> Change Filter
    │   └─> useEffect Trigger
    │       └─> Clear summaries
    │           └─> load(0) with new filters
    │               └─> (Same flow as above)
    │
    ├─> Click Load More
    │   └─> loadMore()
    │       └─> load(summaries.length)
    │           └─> GET /summary?offset={current}&limit=10
    │               └─> (Same processing, different offset)
    │                   └─> Append to existing summaries
    │
    └─> Click Refresh
        └─> load(0)
            └─> (Forces fresh fetch, bypasses cache)
```

---

## Summary

**Summary View is designed for deep analysis**:
- ✅ Fetches full message history (up to 100 messages per chat)
- ✅ Analyzes conversation context (up to 50 messages to AI)
- ✅ Provides comprehensive insights (summary, key points, action items, sentiment)
- ✅ Supports filtering and pagination
- ✅ Caches for 6 hours to reduce API calls
- ✅ Processes 10 chats per page for manageable load times

**The idea**: Give you a comprehensive review of conversations over time periods, with AI-generated insights to help you understand what happened and what needs attention.
