# UI/UX Requirements - Telegram Copilot

## Overall Application Structure

### Layout Hierarchy
```
┌─────────────────────────────────────────┐
│ Header (Fixed, Sticky)                  │
│ - Logo + Navigation Tabs + User Info    │
├─────────────────────────────────────────┤
│                                         │
│ Main Content Area (Scrollable)          │
│ - View-specific content                 │
│                                         │
│                    ┌──────────────────┐ │
│                    │ Chat Panel       │ │
│                    │ (Fixed Right)    │ │
│                    │ (400px width)    │ │
│                    └──────────────────┘ │
└─────────────────────────────────────────┘
```

### Navigation Pattern
- **Header Navigation**: 6 tabs (Briefing, Summary, Chats, Contacts, Outreach, Offboard)
- **Click Behavior**: Clicking a tab switches the main view, active tab is highlighted
- **Chat Panel**: Independent overlay, can be open while on any tab
- **State**: Active view stored in state, persists until user switches

---

## 1. Briefing View

### Layout
```
┌─────────────────────────────────────┐
│ Header: Greeting + Refresh Button   │
├─────────────────────────────────────┤
│ Stats Bar (3 metrics)               │
├─────────────────────────────────────┤
│ 🔴 Needs Reply Section              │
│ ┌─────────────────────────────────┐ │
│ │ Response Cards (vertical list)  │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ 🟡 FYI Section                      │
│ ┌─────────────────────────────────┐ │
│ │ FYI Items (compact list)         │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### Interactions

**Refresh Button**:
- Click → Forces fresh data fetch (bypasses cache)
- Shows loading state during fetch
- Updates all sections with new data

**Response Card** (Needs Reply items):
- **Card Header Click** → Opens chat panel with that conversation
- **Last Message Click** → Opens chat panel
- **✨ AI Button** → Generates new AI draft, replaces textarea content
- **💬 Open Button** → Opens chat panel
- **📨 Send Button** → 
  - Sends message via API
  - Shows "✅ Sent" confirmation
  - Card disappears after 500ms
  - Removes from needs_response list
- **Textarea** → Editable draft reply, can type custom message
- **Enter Key** → Sends message (if draft not empty)

**FYI Item**:
- **Click anywhere** → Opens chat panel with that conversation

**Empty State**:
- Shows "🎉 All caught up!" when no unread messages

---

## 2. Summary View

### Layout
```
┌─────────────────────────────────────┐
│ Header: Title + Filters + Refresh   │
│ - Filter: All/DMs/Groups/Channels   │
│ - Time: Week/Month/3 Months         │
│ - Checkbox: Needs Response Only     │
├─────────────────────────────────────┤
│ Stats Bar (3 metrics)               │
├─────────────────────────────────────┤
│ Summary Cards (vertical list)        │
│ ┌─────────────────────────────────┐ │
│ │ Card with AI summary             │ │
│ │ - Icon, Name, Metadata           │ │
│ │ - Summary text                    │ │
│ │ - Key points                     │ │
│ │ - Action items                   │ │
│ │ - Sentiment + Date               │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ Load More Button (if more available)│
└─────────────────────────────────────┘
```

### Interactions

**Filter Changes**:
- **Type Filter Change** → Clears summaries, reloads from offset 0
- **Days Filter Change** → Clears summaries, reloads from offset 0
- **Needs Response Checkbox** → Clears summaries, reloads filtered
- **Refresh Button** → Forces fresh fetch, clears cache

**Summary Card**:
- **Click anywhere on card** → Opens chat panel with that conversation
- Cards with `needs_response: true` have orange left border

**Load More Button**:
- **Click** → Loads next 10 summaries, appends to list
- Shows "⏳ Loading..." while fetching
- Button text shows remaining count: "📥 Load More (X remaining)"
- Disappears when all loaded

**Loading State**:
- Shows spinner + "📊 Generating summaries..." on initial load
- Shows "Loading first 10 chats..." hint

---

## 3. Contacts View

### Layout
```
┌─────────────────────────────────────┐
│ Toolbar: Title + Cache + Refresh +  │
│         Search + Tag Filter + Sort   │
├─────────────────────────────────────┤
│ Bulk Actions Bar (when selected)     │
├─────────────────────────────────────┤
│ ┌──────────────────┬──────────────┐ │
│ │ Contacts List     │ Detail Panel │ │
│ │ (Left Column)     │ (Right)      │ │
│ │                   │              │ │
│ │ - Checkbox        │ - Name       │ │
│ │ - Name            │ - Tags       │ │
│ │ - Last Contact    │ - Stats      │ │
│ │ - Tags            │ - Open Chat  │ │
│ └──────────────────┴──────────────┘ │
└─────────────────────────────────────┘
```

### Interactions

**Toolbar**:
- **Refresh Button** → Forces fresh contact fetch, shows loading
- **Search Input** → Filters contacts in real-time (debounced)
- **Tag Filter** → Filters to show only contacts with selected tag
- **Sort Dropdown** → Changes sort order, reloads list

**Contact List**:
- **Checkbox Click** → Toggles selection (doesn't open detail)
- **Row Click** (name/date/tags) → Opens detail panel on right
- **Header Checkbox** → Selects/deselects all filtered contacts

**Bulk Actions Bar** (appears when contacts selected):
- **Tag Dropdown** → Select tag to apply
- **Apply Tag Button** → Adds tag to all selected contacts
- **Delete Button** → 
  - Shows confirmation: "Delete X contacts from Telegram? This cannot be undone."
  - On confirm: Deletes from Telegram, removes from list
  - Shows success alert with count
- **Clear Button** → Deselects all

**Detail Panel** (right side):
- **✨ AI Suggest Button** → Generates suggested tag, shows alert
- **Tag × Button** → Removes tag from contact
- **Add Tag Dropdown** → Select tag, "Add" button appears
- **Add Button** → Adds selected tag to contact
- **💬 Open Chat Button** → Opens chat panel

**Contact Row States**:
- **Selected** (detail open): Blue left border, highlighted background
- **Never Contacted**: Dimmed appearance, "Never" in red
- **Selected for Bulk**: Checkbox checked

---

## 4. Outreach View

### Layout
```
┌─────────────────────────────────────┐
│ Title + Hint Text                    │
├─────────────────────────────────────┤
│ ┌──────────────────┬──────────────┐ │
│ │ Contacts Panel   │ Compose      │ │
│ │ (Left)           │ Panel (Right) │ │
│ │                  │               │ │
│ │ - Search         │ - Message     │ │
│ │ - Tag Filter     │   Textarea    │ │
│ │ - Select All     │ - Schedule    │ │
│ │ - Clear          │   Checkbox    │ │
│ │ - Checkbox List  │ - Preview     │ │
│ │                  │ - Send Button │ │
│ │                  │ - Preview List│ │
│ │                  │ - Result Box  │ │
│ └──────────────────┴──────────────┘ │
└─────────────────────────────────────┘
```

### Interactions

**Contacts Panel**:
- **Search Input** → Filters contacts in real-time
- **Tag Filter** → Filters by tag
- **All Button** → Selects all filtered contacts
- **Clear Button** → Deselects all
- **Checkbox** → Toggles individual contact selection

**Compose Panel**:
- **Message Textarea** → Type message, use `{{name}}` for personalization
- **Schedule Checkbox** → 
  - Checked: Shows datetime picker, sets default to tomorrow
  - Unchecked: Hides datetime picker
- **👁 Preview Button** → 
  - Shows personalized messages for first 10 selected contacts
  - Displays: "Name: Personalized message"
  - Requires: At least 1 selected + message text
- **📨 Send Now / 📅 Schedule Button** → 
  - Sends messages with 60s delay between each
  - Shows "⏳ Sending..." during process
  - Button text shows count: "Send Now (5)" or "Schedule (5)"
  - On completion: Shows result box, clears selection and message

**Result Box**:
- **Success**: "✅ X of Y sent/scheduled"
- **Errors**: Shows failed count
- **Rate Limited**: Shows rate limited count
- **Error State**: Red background if errors occurred

**Preview List**:
- Shows personalized messages for selected contacts
- Updates when selection or message changes

---

## 5. Offboarding View

### Layout
```
┌─────────────────────────────────────┐
│ Title + Hint                         │
├─────────────────────────────────────┤
│ Rate Limit Info Bar                  │
├─────────────────────────────────────┤
│ ┌──────────────────┬──────────────┐ │
│ │ Contacts Panel   │ Groups Panel │ │
│ │ (Left)           │ (Right)      │ │
│ │                  │               │ │
│ │ - Search         │ - User Name   │ │
│ │ - Contact List   │ - Group Count │ │
│ │                  │ - Refresh Btn │ │
│ │                  │ - Groups List │ │
│ │                  │   (with Remove│ │
│ │                  │    buttons)   │ │
│ └──────────────────┴──────────────┘ │
└─────────────────────────────────────┘
```

### Interactions

**Rate Limit Info**:
- Shows: "X lookups remaining today" + "Y cached"
- Green if remaining > 0, red if 0

**Contacts Panel**:
- **Search Input** → Filters contacts
- **Contact Click** → 
  - Triggers group lookup API call
  - Shows loading spinner: "Finding groups..."
  - If cached: Returns immediately
  - If not cached: Uses 1 of 5 daily lookups
  - On error: Shows alert with error message

**Groups Panel**:
- **Empty State**: "← Select a person to see common groups"
- **Loading State**: Spinner + "Finding groups..."
- **Refresh Button** (if cached) → Forces fresh lookup, uses daily limit
- **Group Row**:
  - **Can Remove** (green left border): Shows "🚫 Remove" button
  - **Need Admin**: Shows "Need admin" text (no button)
  - **Remove Button Click** → 
    - Removes user from group
    - Shows "⏳" during removal
    - Updates list (removes group from display)
    - Updates total count

**Contact States**:
- **Selected**: Highlighted with blue left border
- **Cached**: Shows 📦 badge, dimmed appearance

---

## 6. Chats View

### Layout
```
┌─────────────────────────────────────┐
│ Header: Title + Search + Type Filter│
├─────────────────────────────────────┤
│ Chats List                           │
│ ┌─────────────────────────────────┐ │
│ │ Chat Row                        │ │
│ │ - Icon                          │ │
│ │ - Name + Preview                │ │
│ │ - Unread Badge                  │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### Interactions

**Header**:
- **Search Input** → Filters chats by name in real-time
- **Type Filter** → Filters by DM/Group/Channel

**Chat Row**:
- **Click anywhere** → Opens chat panel with that conversation
- **Hover** → Highlights row

---

## Chat Panel (Global Component)

### Layout
```
┌─────────────────────────────────────┐
│ Header: Chat Name + Close Button (✕)│
├─────────────────────────────────────┤
│ Messages Area (Scrollable)          │
│ ┌─────────────────────────────────┐ │
│ │ Incoming/Outgoing Messages      │ │
│ │ - Sender name                    │ │
│ │ - Message text                   │ │
│ │ - Timestamp                      │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ Input Area                           │
│ - Textarea (3 rows)                 │
│ - ✨ AI Draft Button                │
│ - 📨 Send Button                    │
└─────────────────────────────────────┘
```

### Interactions

**Opening**:
- Triggered by clicking chat/conversation from any view
- Slides in from right (400px width)
- Main content shifts left (margin-right: 400px)
- Loads last 50 messages
- Auto-generates AI draft on open

**Header**:
- **Close Button (✕)** → Closes panel, main content expands back

**Messages**:
- **Auto-scroll**: Scrolls to bottom when messages load
- **Incoming**: Left-aligned, gray background
- **Outgoing**: Right-aligned, blue background

**Input Area**:
- **✨ AI Draft Button** → 
  - Generates new AI draft based on conversation
  - Replaces textarea content
  - Shows loading state during generation
- **Textarea** → 
  - Editable, pre-filled with AI draft
  - Enter key (without Shift) sends message
  - Shift+Enter creates new line
- **📨 Send Button** → 
  - Sends message via API
  - Shows "⏳" during send
  - Clears textarea on success
  - Reloads messages to show sent message
  - On error: Shows alert

**State Management**:
- Panel persists across view changes
- Closing panel clears active chat state
- Reopening same chat reloads messages

---

## User Flows

### Flow 1: Responding to Urgent Message
1. User opens Briefing view
2. Sees urgent card in "Needs Reply" section
3. Clicks card header or message → Chat panel opens
4. Reviews AI-generated draft in textarea
5. Edits draft if needed
6. Clicks Send or presses Enter
7. Message sent, card disappears from briefing

### Flow 2: Bulk Outreach Campaign
1. User navigates to Outreach view
2. Filters contacts by tag (e.g., "investor")
3. Selects multiple contacts via checkboxes
4. Types message with `{{name}}` placeholder
5. Clicks Preview → Sees personalized messages
6. Reviews preview, adjusts message if needed
7. Optionally checks "Schedule for later" and sets date
8. Clicks Send Now or Schedule
9. Sees result box with success/error counts

### Flow 3: Offboarding Team Member
1. User navigates to Offboarding view
2. Searches for contact name
3. Clicks contact → Groups panel shows loading
4. Views list of shared groups
5. Identifies groups where user is admin (green border)
6. Clicks "Remove" button for each group
7. Sees group disappear from list as removed
8. Continues until all groups processed

### Flow 4: Reviewing Conversation History
1. User navigates to Summary view
2. Selects time range (Week/Month/3 Months)
3. Filters by type (DMs/Groups/Channels)
4. Optionally checks "Needs Response Only"
5. Scrolls through summary cards
6. Clicks card → Opens chat panel
7. Reviews full conversation
8. Can send reply directly from panel

### Flow 5: Managing Contacts
1. User navigates to Contacts view
2. Searches or filters by tag
3. Clicks contact row → Detail panel opens
4. Reviews tags, adds/removes tags
5. Optionally clicks "✨ AI Suggest" for tag recommendation
6. Clicks "💬 Open Chat" to start conversation

---

## State Management & Data Flow

### Global State
- **Active View**: Determines which main view is displayed
- **Active Chat**: Controls chat panel visibility and content
- **User Info**: Displayed in header

### View-Specific State
- **Briefing**: Cached data, loading state
- **Summary**: Filters, pagination offset, summaries list
- **Contacts**: Selected contact, selected IDs for bulk, filters
- **Outreach**: Selected contacts, message, schedule date, preview, results
- **Offboarding**: Selected user, groups data, rate limit status
- **Chats**: Chats list, filters

### Data Fetching Patterns
- **On Mount**: Views fetch initial data when opened
- **On Filter Change**: Clears and reloads data
- **On Refresh**: Forces fresh fetch, bypasses cache
- **On Action**: Updates local state immediately, syncs with API

### Error Handling
- **API Errors**: Show alert with error message
- **Rate Limits**: Show specific wait time or limit message
- **Network Errors**: Generic error message
- **Validation**: Disable buttons when required fields empty

---

## Responsive Behavior

### Desktop (> 1000px)
- Chat panel: Fixed right sidebar (400px)
- Two-column layouts: Side-by-side
- Full feature set available

### Mobile/Tablet (< 1000px)
- Chat panel: Full-width overlay
- Two-column layouts: Stacked vertically
- Detail panels: Hidden or modal
- Touch-optimized button sizes

---

## Loading States

### Initial Load
- Briefing: "🧠 Analyzing inbox..." with spinner
- Summary: "📊 Generating summaries..." with spinner
- Contacts: "Loading contacts..."
- Other views: "Loading..." text

### Action Loading
- Send buttons: Show "⏳" or "Sending..."
- AI Draft: Button shows "⏳"
- Refresh: Button shows "⏳"
- Remove: Button shows "⏳"

### Progressive Loading
- Summary: Loads 10 at a time, "Load More" button
- Messages: Loads 50 at a time
- Contacts: Loads all at once (cached)

---

## Empty States

- **Briefing**: "🎉 All caught up!"
- **Summary**: "No chats found for this time period"
- **Contacts**: No specific empty state (shows 0 count)
- **Outreach**: No contacts selected message
- **Offboarding**: "← Select a person to see common groups"
- **Groups**: "No common groups found"
- **Chats**: No specific empty state

---

## Confirmation Dialogs

### Delete Contacts
- **Trigger**: Bulk delete button click
- **Message**: "Delete X contacts from Telegram? This cannot be undone."
- **Actions**: Confirm or Cancel
- **On Confirm**: Proceeds with deletion

### No Confirmations For
- Sending messages (immediate)
- Removing from groups (immediate)
- Tagging contacts (immediate)
- Scheduling messages (immediate)

---

## Keyboard Shortcuts

- **Enter** (in message textarea): Sends message
- **Shift+Enter** (in message textarea): New line
- **Tab**: Navigates through form elements
- **Escape**: (Not implemented, but could close chat panel)

---

## Visual Feedback

### Success
- ✅ Checkmark icons
- Green result boxes
- "Sent" confirmation cards
- Success alerts

### Errors
- ❌ Error icons
- Red error banners
- Error alerts with messages
- Disabled buttons with error state

### Warnings
- ⚠️ Warning icons
- Yellow warning banners
- Rate limit messages

### Information
- 💡 Info icons
- Blue info banners
- Cache indicators
- Hint text
