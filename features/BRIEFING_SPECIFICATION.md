# Briefing View - Complete Specification

## Overview

The Briefing view is the primary inbox management interface that uses AI to categorize unread Telegram messages into actionable items ("Needs Reply") and informational items ("FYI"). It provides quick reply functionality with AI-generated drafts.

---

## Layout Structure

### Visual Hierarchy
```
┌─────────────────────────────────────────────────────────────┐
│ Briefing View Container                                      │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Header Section                                           │ │
│ │ ┌──────────────────────┬──────────────────────────────┐ │ │
│ │ │ Greeting (H2)        │ Actions (Right-aligned)      │ │ │
│ │ │ "Good morning"        │ - Cache Badge (if cached)   │ │ │
│ │ │ "Good afternoon"     │ - Refresh Button            │ │ │
│ │ │ "Good evening"        │                              │ │ │
│ │ └──────────────────────┴──────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Stats Bar (Horizontal, 3 equal-width columns)           │ │
│ │ ┌──────────────┬──────────────┬──────────────┐        │ │
│ │ │ Need Reply   │ FYI          │ Unread       │        │ │
│ │ │ (Large #)    │ (Large #)    │ (Large #)    │        │ │
│ │ │ (Small label)│ (Small label)│ (Small label)│        │ │
│ │ └──────────────┴──────────────┴──────────────┘        │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🔴 Needs Reply Section (Conditional)                     │ │
│ │ ┌─────────────────────────────────────────────────────┐ │ │
│ │ │ Section Header: "🔴 Needs Reply (X)"              │ │ │
│ │ ├─────────────────────────────────────────────────────┤ │ │
│ │ │ Response Cards (Vertical Stack)                    │ │ │
│ │ │ ┌───────────────────────────────────────────────┐ │ │ │
│ │ │ │ ResponseCard Component                        │ │ │ │
│ │ │ │ (See ResponseCard spec below)                 │ │ │ │
│ │ │ └───────────────────────────────────────────────┘ │ │ │
│ │ │ ... (one card per needs_response item)            │ │ │
│ │ └─────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🟡 FYI Section (Conditional)                            │ │
│ │ ┌─────────────────────────────────────────────────────┐ │ │
│ │ │ Section Header: "🟡 FYI (X)"                       │ │ │
│ │ ├─────────────────────────────────────────────────────┤ │ │
│ │ │ FYI Items (Vertical List)                           │ │ │
│ │ │ ┌───────────────────────────────────────────────┐ │ │ │
│ │ │ │ FYI Item (Grid: Name | Count | Summary)       │ │ │ │
│ │ │ └───────────────────────────────────────────────┘ │ │ │
│ │ │ ... (one item per fyi_summaries item)            │ │ │
│ │ └─────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Empty State (Conditional - only if both sections empty) │ │
│ │ "🎉 All caught up!"                                     │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Loading State (Conditional - during initial load)       │ │
│ │ - Spinner (centered, 40px)                             │ │
│ │ - Text: "🧠 Analyzing inbox..."                        │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Specifications

### 1. BriefingView (Main Component)

#### Props
- `onOpenChat: (chatId: number, chatName: string) => void` - Opens chat panel
- `sendMessage: (chatId: number, message: string) => Promise<void>` - Sends message
- `getDraft: (chatId: number) => Promise<string>` - Gets AI draft

#### State
```typescript
{
  data: BriefingData | null,
  loading: boolean
}
```

#### Data Structure
```typescript
interface BriefingData {
  needs_response: ResponseItem[],
  fyi_summaries: FYIItem[],
  stats: {
    needs_response_count: number,
    fyi_count: number,
    total_unread: number
  },
  generated_at: string,  // ISO datetime
  cached: boolean,
  cache_age?: string     // "1h ago", "2d ago", etc.
}

interface ResponseItem {
  id: number,
  chat_id: number,
  chat_name: string,
  chat_type: 'dm' | 'group' | 'channel',
  unread_count: number,
  last_message: string | null,
  last_message_date: string | null,  // ISO datetime
  priority: 'urgent' | 'needs_reply',
  summary: string,
  suggested_reply: string | null
}

interface FYIItem {
  id: number,
  chat_id: number,
  chat_name: string,
  chat_type: 'dm' | 'group' | 'channel',
  unread_count: number,
  last_message: string | null,
  last_message_date: string | null,
  priority: 'fyi',
  summary: string
}
```

#### Lifecycle
1. **On Mount**: 
   - Sets `loading = true`
   - Calls `load(false)` - fetches data (uses cache if available)
   - On completion: Sets `loading = false`, updates `data`

2. **On Unmount**: No cleanup needed

#### Methods

**`load(force: boolean)`**
- **Parameters**: 
  - `force: boolean` - If true, bypasses cache
- **Behavior**:
  1. Sets `loading = true`
  2. Makes GET request to `/briefing?force_refresh={force}`
  3. On success: Updates `data` with response
  4. On error: Logs to console, `data` remains unchanged
  5. Sets `loading = false`

**`removeItem(chatId: number)`**
- **Parameters**: `chatId: number` - ID of chat to remove
- **Behavior**:
  1. Filters `data.needs_response` array, removes item with matching `chat_id`
  2. Updates `data` state with filtered array
  3. Does NOT update stats (stats remain unchanged)

#### Rendering Logic

**Greeting Calculation**:
```javascript
const hour = new Date().getHours()
const greeting = 
  hour < 12 ? 'Good morning' :
  hour < 17 ? 'Good afternoon' : 
  'Good evening'
```

**Conditional Rendering**:
- **Loading State**: If `loading === true`, show loading screen
- **Needs Reply Section**: Render if `data?.needs_response?.length > 0`
- **FYI Section**: Render if `data?.fyi_summaries?.length > 0`
- **Empty State**: Render if both sections are empty or don't exist
- **Cache Badge**: Render if `data?.cached === true`

---

### 2. ResponseCard Component

#### Props
```typescript
{
  item: ResponseItem,
  onOpenChat: (chatId: number, chatName: string) => void,
  onSend: (chatId: number, message: string) => Promise<void>,
  onDraft: (chatId: number) => Promise<string>,
  onRemove: (chatId: number) => void
}
```

#### State
```typescript
{
  draft: string,           // Initialized from item.suggested_reply
  sending: boolean,
  loadingDraft: boolean,
  sent: boolean
}
```

#### Initialization
- `draft` initialized to `item.suggested_reply || ''`
- All other states initialized to `false`

#### Layout Structure
```
┌─────────────────────────────────────────┐
│ Card Container                          │
│ ┌─────────────────────────────────────┐ │
│ │ Card Header                         │ │
│ │ ┌──────────────────┬──────────────┐ │ │
│ │ │ Card Title       │ Badge        │ │ │
│ │ │ (Clickable)      │ (Right)      │ │ │
│ │ │ - Chat Name      │ - Urgent/    │ │ │
│ │ │ - Meta: type ·   │   Reply      │ │ │
│ │ │   unread count   │              │ │ │
│ │ └──────────────────┴──────────────┘ │ │
│ ├─────────────────────────────────────┤ │
│ │ Last Message (Clickable)            │ │
│ │ "{last_message}"                    │ │
│ ├─────────────────────────────────────┤ │
│ │ AI Summary (Conditional)            │ │
│ │ "AI: {summary}"                     │ │
│ ├─────────────────────────────────────┤ │
│ │ Draft Textarea                      │ │
│ │ - 2 rows                           │ │
│ │ - Placeholder: "Your reply..."     │ │
│ │ - Value: {draft}                    │ │
│ ├─────────────────────────────────────┤ │
│ │ Card Actions                        │ │
│ │ ┌──────────┬──────────┬──────────┐ │ │
│ │ │ ✨ AI    │ 💬 Open  │ 📨 Send  │ │ │
│ │ └──────────┴──────────┴──────────┘ │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

#### Interactions

**Card Header Click** (`card-title` div):
- **Action**: Calls `onOpenChat(item.chat_id, item.chat_name)`
- **Result**: Opens chat panel with this conversation

**Last Message Click** (`card-message` div):
- **Action**: Calls `onOpenChat(item.chat_id, item.chat_name)`
- **Result**: Opens chat panel with this conversation

**✨ AI Button**:
- **State Check**: If `loadingDraft === true`, button shows "⏳" and is disabled
- **Action**: 
  1. Sets `loadingDraft = true`
  2. Calls `onDraft(item.chat_id)` (async)
  3. On success: Updates `draft` state with returned string
  4. On error: Logs to console, `draft` unchanged
  5. Sets `loadingDraft = false`
- **Button Text**: "⏳" when loading, "✨ AI" otherwise

**💬 Open Button**:
- **Action**: Calls `onOpenChat(item.chat_id, item.chat_name)`
- **Result**: Opens chat panel

**📨 Send Button**:
- **Disabled Conditions**: 
  - `!draft.trim()` (empty or whitespace only)
  - `sending === true`
- **Action**:
  1. If disabled, no action
  2. Sets `sending = true`
  3. Calls `onSend(item.chat_id, draft)` (async)
  4. On success:
     - Sets `sent = true`
     - After 500ms: Calls `onRemove(item.chat_id)`
  5. On error: Shows alert "Failed to send: {error.message}"
  6. Sets `sending = false`
- **Button Text**: "⏳" when sending, "📨 Send" otherwise

**Draft Textarea**:
- **Controlled Component**: Value bound to `draft` state
- **onChange**: Updates `draft` state with new value
- **Placeholder**: "Your reply..."
- **Rows**: 2
- **No Enter Key Handler**: Enter key does nothing (unlike chat panel)

**Sent State**:
- **Condition**: If `sent === true`, renders different component:
  ```jsx
  <div className="card sent">
    ✅ Sent to {item.chat_name}
  </div>
  ```
- **Behavior**: This replaces entire card, no interactions available
- **Auto-removal**: After 500ms, card is removed from list via `onRemove`

#### Badge Display Logic
```javascript
Badge type={item.priority}>
  {item.priority === 'urgent' ? '🔴 Urgent' : '🟠 Reply'}
</Badge>
```

---

### 3. FYI Item Component

#### Layout Structure
```
┌─────────────────────────────────────────┐
│ FYI Item (Grid: 3 columns)             │
│ ┌──────────┬──────────┬──────────────┐ │
│ │ Name     │ Count    │ Summary      │ │
│ │ (Left)   │ (Center) │ (Right)      │ │
│ └──────────┴──────────┴──────────────┘ │
└─────────────────────────────────────────┘
```

#### Data Display
- **Name**: `item.chat_name`
- **Count**: `item.unread_count` (displayed as number)
- **Summary**: `item.summary || 'No action needed'`

#### Interactions
- **Click Anywhere**: Calls `onOpenChat(item.chat_id, item.chat_name)`
- **Result**: Opens chat panel with this conversation

---

## API Contract

### Endpoint: `GET /briefing`

#### Query Parameters
- `force_refresh: boolean` (optional, default: false)
  - If `true`: Bypasses cache, fetches fresh data
  - If `false` or omitted: Uses cache if available and not expired

#### Cache Behavior
- **Cache File**: `backend/cache/briefing.json`
- **Cache Duration**: 1 hour
- **Cache Structure**:
  ```json
  {
    "timestamp": "2026-01-23T10:30:00",
    "data": {
      "needs_response": [...],
      "fyi_summaries": [...],
      "stats": {...},
      "generated_at": "...",
      "cached": false
    }
  }
  ```

#### Response Format
```json
{
  "needs_response": [
    {
      "id": 123,
      "chat_id": 456,
      "chat_name": "John Doe",
      "chat_type": "dm",
      "unread_count": 3,
      "last_message": "Hey, can you help with...",
      "last_message_date": "2026-01-23T10:00:00",
      "priority": "urgent",
      "summary": "User asking for help with project",
      "suggested_reply": "Hi! I'd be happy to help..."
    }
  ],
  "fyi_summaries": [
    {
      "id": 789,
      "chat_id": 101,
      "chat_name": "News Channel",
      "chat_type": "channel",
      "unread_count": 5,
      "last_message": "Breaking news...",
      "last_message_date": "2026-01-23T09:00:00",
      "priority": "fyi",
      "summary": "News updates, no action needed"
    }
  ],
  "stats": {
    "needs_response_count": 5,
    "fyi_count": 12,
    "total_unread": 17
  },
  "generated_at": "2026-01-23T10:30:00",
  "cached": true,
  "cache_age": "15m ago"
}
```

#### Backend Processing

1. **Cache Check** (if `force_refresh === false`):
   - Loads cache file if exists
   - Checks if cache age < 1 hour
   - If valid: Returns cached data with `cached: true` and `cache_age`

2. **Data Collection**:
   - Iterates through up to 100 dialogs
   - Filters: Only dialogs with `unread_count > 0`
   - Collects: id, name, type, unread_count, last_message, last_message_date

3. **AI Analysis**:
   - Sends up to 40 chats to Claude AI
   - AI categorizes each chat as: `urgent`, `needs_reply`, or `fyi`
   - AI generates: summary (1 sentence), suggested_reply (for urgent/needs_reply)

4. **Categorization**:
   - `priority === 'urgent'` or `'needs_reply'` → `needs_response` array
   - `priority === 'fyi'` → `fyi_summaries` array

5. **Sorting**:
   - `needs_response` sorted: `urgent` first (priority 0), then `needs_reply` (priority 1)

6. **Stats Calculation**:
   - `needs_response_count`: Length of needs_response array
   - `fyi_count`: Length of fyi_summaries array
   - `total_unread`: Sum of all unread_count values

7. **Cache Save**:
   - Saves result to cache file
   - Sets `cached: false` in response (fresh data)

---

## User Interactions & Behaviors

### 1. Initial Load

**Trigger**: User navigates to Briefing view

**Sequence**:
1. Component mounts
2. `loading = true`
3. GET request to `/briefing` (no force_refresh)
4. If cache exists and valid (< 1 hour old):
   - Returns cached data immediately
   - `cached: true` in response
5. If no cache or expired:
   - Fetches dialogs from Telegram
   - Sends to AI for analysis
   - Returns fresh data
   - `cached: false` in response
6. `loading = false`
7. Renders content

**Loading State**:
- Shows centered spinner (40px)
- Text: "🧠 Analyzing inbox..."
- Blocks all content

### 2. Refresh Action

**Trigger**: User clicks "🔄 Refresh" button

**Sequence**:
1. Button click handler calls `load(true)`
2. `loading = true` (but NO loading screen shown - content remains visible)
3. GET request to `/briefing?force_refresh=true`
4. Bypasses cache, fetches fresh data
5. Updates `data` state
6. `loading = false`
7. UI updates with new data

**Visual Feedback**:
- Button shows "⏳" during refresh (if implemented)
- Cache badge disappears (if was showing)
- Stats and cards update

### 3. Sending Reply from Card

**Trigger**: User clicks "📨 Send" button on ResponseCard

**Sequence**:
1. Validates: `draft.trim()` must be truthy
2. `sending = true`
3. Button text changes to "⏳"
4. Button becomes disabled
5. Calls `onSend(item.chat_id, draft)`
6. API: POST `/chats/{chat_id}/send` with `{chat_id, message: draft}`
7. On success:
   - `sent = true`
   - Card transforms to "✅ Sent to {name}" message
   - After 500ms: Card removed from list via `onRemove`
8. On error:
   - Alert: "Failed to send: {error.message}"
   - `sending = false`
   - Button re-enabled

**Edge Cases**:
- Empty draft: Button disabled, no action
- Network error: Alert shown, state reset
- Rate limit: Error message in alert

### 4. Generating AI Draft

**Trigger**: User clicks "✨ AI" button on ResponseCard

**Sequence**:
1. `loadingDraft = true`
2. Button shows "⏳" and becomes disabled
3. Calls `onDraft(item.chat_id)`
4. API: POST `/chats/{chat_id}/draft`
5. Backend:
   - Fetches last 20 messages from chat
   - Sends to Claude AI with conversation context
   - Returns generated draft
6. On success:
   - Updates `draft` state with new text
   - Textarea content updates
7. On error:
   - Logs to console
   - Draft unchanged
8. `loadingDraft = false`
9. Button re-enabled

### 5. Opening Chat Panel

**Trigger**: 
- Click on ResponseCard header
- Click on ResponseCard last message
- Click on "💬 Open" button
- Click on FYI item

**Sequence**:
1. Calls `onOpenChat(chat_id, chat_name)`
2. Parent component sets `activeChat = {id: chat_id, name: chat_name}`
3. Chat panel slides in from right (400px width)
4. Main content shifts left (margin-right: 400px)
5. Chat panel loads messages and generates draft

**State Persistence**:
- Briefing view state remains unchanged
- User can return to briefing view, cards still visible
- Chat panel can be closed independently

### 6. Card Removal After Send

**Trigger**: Message successfully sent

**Sequence**:
1. `sent = true` set
2. Card re-renders as "✅ Sent to {name}" message
3. After 500ms timeout:
   - Calls `onRemove(item.chat_id)`
   - Parent filters `needs_response` array
   - Card disappears from list
4. Stats remain unchanged (not recalculated)

---

## Edge Cases & Error Handling

### 1. No Unread Messages

**Condition**: All dialogs have `unread_count === 0`

**Behavior**:
- Backend returns empty arrays: `needs_response: []`, `fyi_summaries: []`
- Stats: All zeros
- Renders empty state: "🎉 All caught up!"

### 2. API Error During Load

**Condition**: Network error or 500 error from `/briefing`

**Behavior**:
- Error logged to console
- `data` remains `null` or previous value
- `loading = false`
- User sees previous data or empty state
- No error message shown to user

### 3. AI Analysis Failure

**Condition**: Claude API fails or returns invalid JSON

**Behavior**:
- Backend: `analyze_inbox_priorities` returns empty array `[]`
- All chats default to `priority: 'fyi'`
- All items go to `fyi_summaries` array
- `needs_response` remains empty
- No error shown to user

### 4. Empty Suggested Reply

**Condition**: AI returns `null` or empty string for `suggested_reply`

**Behavior**:
- ResponseCard `draft` initialized to empty string `''`
- Textarea shows placeholder: "Your reply..."
- User must type manually or click "✨ AI" to generate

### 5. Cache File Corruption

**Condition**: Cache file exists but JSON is invalid

**Behavior**:
- Backend: `load_json_cache` catches exception, returns `None`
- Cache treated as invalid
- Fresh data fetched
- No error shown

### 6. Very Long Last Message

**Condition**: `last_message` exceeds display width

**Behavior**:
- Backend: Truncates to 300 characters when sending to AI
- Frontend: No truncation, displays full text
- CSS: Text may wrap or overflow (handled by CSS)

### 7. Missing Chat Name

**Condition**: `dialog.name` is `null` or empty

**Behavior**:
- Backend: Sets `chat_name: "Unknown"`
- Frontend: Displays "Unknown" in card

### 8. Concurrent Refresh

**Condition**: User clicks refresh multiple times quickly

**Behavior**:
- Each click triggers new `load(true)` call
- Multiple requests may be in flight
- Last response wins (updates state)
- No request cancellation

### 9. Send While Draft Loading

**Condition**: User clicks Send while AI draft is generating

**Behavior**:
- Send button disabled if `loadingDraft === true` (not explicitly, but draft may be empty)
- Send uses current draft value (may be old or empty)
- No special handling

### 10. Card Removed While Sending

**Condition**: User sends message, then quickly navigates away

**Behavior**:
- Send operation continues in background
- `onRemove` called after 500ms timeout
- If component unmounted, timeout still executes (potential memory leak)
- No error handling for unmounted component

---

## Performance Considerations

### 1. Initial Load Time
- **With Cache**: < 100ms (file read)
- **Without Cache**: 2-10 seconds (depends on unread count and AI response time)
  - Telegram API: ~1-2 seconds for 100 dialogs
  - AI Analysis: ~2-5 seconds for 40 chats
  - Total: ~3-7 seconds typical

### 2. Refresh Time
- Same as initial load without cache
- User sees existing content during refresh (no loading screen)

### 3. AI Draft Generation
- **Time**: ~1-3 seconds per request
- **Blocking**: Button disabled during generation
- **No Cancellation**: Request cannot be cancelled

### 4. Message Sending
- **Time**: < 1 second typically
- **Blocking**: Button disabled, card shows "⏳"
- **Network Dependent**: May take longer on slow connection

### 5. Cache Hit Rate
- **Expected**: High (users typically refresh within 1 hour)
- **Cache Age Display**: Helps users understand data freshness

---

## Accessibility

### Keyboard Navigation
- **Tab Order**: Header → Refresh Button → Cards → Buttons
- **Enter Key**: No special handling in cards (unlike chat panel)
- **Focus States**: Browser default (no custom styling)

### Screen Readers
- **Greeting**: Read as heading level 2
- **Stats**: Numbers read with labels
- **Cards**: Structure not explicitly marked up
- **Buttons**: Read with button role and text content

### Visual Indicators
- **Loading**: Spinner + text
- **Sent State**: ✅ icon + text
- **Priority**: Color-coded badges
- **Cache**: Purple badge with text

---

## Data Flow Diagram

```
User Action
    │
    ├─> Navigate to Briefing
    │   └─> Component Mount
    │       └─> load(false)
    │           └─> GET /briefing
    │               ├─> Cache Hit? ──Yes──> Return Cached Data
    │               └─> Cache Miss? ─No──> Fetch Telegram Dialogs
    │                                       └─> AI Analysis
    │                                           └─> Categorize & Sort
    │                                               └─> Save Cache
    │                                                   └─> Return Data
    │
    ├─> Click Refresh
    │   └─> load(true)
    │       └─> GET /briefing?force_refresh=true
    │           └─> (Same as Cache Miss flow)
    │
    ├─> Click ✨ AI
    │   └─> onDraft(chat_id)
    │       └─> POST /chats/{id}/draft
    │           └─> Fetch Messages
    │               └─> AI Generate Draft
    │                   └─> Update draft state
    │
    ├─> Click 📨 Send
    │   └─> onSend(chat_id, draft)
    │       └─> POST /chats/{id}/send
    │           └─> Telegram API Send
    │               └─> Success: Set sent=true
    │                   └─> Timeout 500ms
    │                       └─> onRemove(chat_id)
    │                           └─> Filter needs_response array
    │
    └─> Click Card/Open
        └─> onOpenChat(chat_id, name)
            └─> Set activeChat state
                └─> Chat Panel Opens
```

---

## Testing Scenarios

### 1. Happy Path
- Load briefing with cached data
- See needs_response and fyi_summaries
- Click AI button, get draft
- Edit draft, send message
- Card disappears after send

### 2. Empty State
- No unread messages
- See "All caught up!" message
- Stats show zeros

### 3. Cache Behavior
- Load with valid cache (< 1 hour)
- See cache badge
- Click refresh
- Cache badge disappears
- Fresh data loads

### 4. Error Handling
- Network error on load
- Previous data or empty state shown
- No crash

### 5. Concurrent Actions
- Click refresh multiple times
- Last response wins
- No duplicate requests (should be prevented)

### 6. Send Edge Cases
- Send with empty draft (disabled)
- Send with network error (alert shown)
- Send successfully (card removed)

### 7. AI Draft Edge Cases
- AI fails (draft unchanged)
- Empty response (draft empty)
- Long response (displayed fully)

---

## Future Enhancements (Not Currently Implemented)

1. **Pagination**: Load more cards if > 40 items
2. **Real-time Updates**: WebSocket for new messages
3. **Keyboard Shortcuts**: Navigate cards with arrow keys
4. **Bulk Actions**: Select multiple cards, send to all
5. **Filtering**: Filter by priority, type, date
6. **Sorting**: Sort cards by priority, date, unread count
7. **Mark as Read**: Option to mark as read without replying
8. **Snooze**: Snooze items to review later
9. **Search**: Search within briefing items
10. **Export**: Export briefing as report
