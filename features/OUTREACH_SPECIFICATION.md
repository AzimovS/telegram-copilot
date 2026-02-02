# Outreach View - Layout & Behavior Specification

## Overview

The Outreach view enables bulk messaging to multiple contacts with personalization and scheduling. It uses a two-column layout: left side for contact selection, right side for message composition and sending.

---

## Layout Structure

### Visual Hierarchy
```
┌─────────────────────────────────────────────────────────────┐
│ Outreach View Container                                      │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Header Section                                           │ │
│ │ - Title: "📨 Outreach"                                   │ │
│ │ - Hint Text: "Send now or schedule messages..."          │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Two-Column Layout                                        │ │
│ │ ┌──────────────────────┬──────────────────────────────┐ │ │
│ │ │ Contacts Panel        │ Compose Panel                │ │ │
│ │ │ (Left, 350px)          │ (Right, flex: 1)             │ │ │
│ │ │                       │                              │ │ │
│ │ │ ┌──────────────────┐ │ ┌──────────────────────────┐ │ │ │
│ │ │ │ Filters           │ │ │ Message Textarea          │ │ │ │
│ │ │ │ - Search Input    │ │ │ (5 rows)                  │ │ │ │
│ │ │ │ - Tag Filter      │ │ │ Placeholder: "Hey {{name}}│ │ │ │
│ │ │ └──────────────────┘ │ │   ..."                    │ │ │ │
│ │ │                       │ └──────────────────────────┘ │ │ │
│ │ │ ┌──────────────────┐ │ ┌──────────────────────────┐ │ │ │
│ │ │ │ Selection Actions │ │ │ Schedule Row             │ │ │ │
│ │ │ │ - Count: "X selected"│ │ │ - Checkbox: "Schedule   │ │ │ │
│ │ │ │ - "All" button     │ │ │   for later"            │ │ │ │
│ │ │ │ - "Clear" button   │ │ │ - Datetime picker       │ │ │ │
│ │ │ └──────────────────┘ │ │   (if checked)          │ │ │ │
│ │ │                       │ └──────────────────────────┘ │ │ │
│ │ │ ┌──────────────────┐ │ ┌──────────────────────────┐ │ │ │
│ │ │ │ Contact List     │ │ │ Action Buttons          │ │ │ │
│ │ │ │ (Scrollable)     │ │ │ - 👁 Preview            │ │ │ │
│ │ │ │                  │ │ │ - 📨 Send Now /         │ │ │ │
│ │ │ │ [☐] Name         │ │ │   📅 Schedule           │ │ │ │
│ │ │ │      Tags        │ │ └──────────────────────────┘ │ │ │
│ │ │ │ ...              │ │ ┌──────────────────────────┐ │ │ │
│ │ │ └──────────────────┘ │ │ Preview List            │ │ │ │
│ │ │                       │ │ (Conditional)            │ │ │ │
│ │ │                       │ │ - "Preview:" header      │ │ │ │
│ │ │                       │ │ - Name: Message          │ │ │ │
│ │ │                       │ └──────────────────────────┘ │ │ │
│ │ │                       │ ┌──────────────────────────┐ │ │ │
│ │ │                       │ │ Result Box               │ │ │ │
│ │ │                       │ │ (Conditional)            │ │ │ │
│ │ │                       │ │ - Success/Error message  │ │ │ │
│ │ │                       │ └──────────────────────────┘ │ │ │
│ │ └──────────────────────┴──────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Layout

### 1. Header Section

**Layout**: Vertical stack

**Elements**:
1. **Title**: "📨 Outreach" (H2)
2. **Hint Text**: 
   - "Send now or schedule messages. Use {{name}} for personalization. Messages are sent with 60s delay to avoid rate limits."
   - Gray text, smaller font

**Behavior**:
- Always visible
- Static content (no interactions)

### 2. Contacts Panel (Left Column)

**Layout**: Fixed width 350px, vertical stack

**Sub-sections**:

#### A. Filters Row
- **Layout**: Horizontal flex
- **Elements**:
  1. **Search Input**: Text input, placeholder "Search..."
  2. **Tag Filter Dropdown**: "All" + list of available tags

**Behavior**:
- Filters work in real-time (no submit)
- Both filters applied simultaneously

#### B. Selection Actions Row
- **Layout**: Horizontal flex, aligned items
- **Elements**:
  1. **Count**: "{selected.length} selected" (text)
  2. **All Button**: "All" (link style) - Selects all filtered contacts
  3. **Clear Button**: "Clear" (link style) - Deselects all

**Behavior**:
- Count updates as selection changes
- "All" selects all currently filtered contacts (not all contacts)
- "Clear" deselects all, count becomes 0

#### C. Contact List
- **Layout**: Scrollable vertical list
- **Item Structure**:
  - Checkbox (left)
  - Contact name (middle, flex: 1)
  - Tags (right, comma-separated, first 2 tags)

**Contact Item**:
```
[☐] John Doe                    investor, builder
```

**Visual States**:
- **Selected**: Checkbox checked
- **Hover**: Background color change
- **Loading**: Shows "Loading..." text

### 3. Compose Panel (Right Column)

**Layout**: Flex: 1 (takes remaining space), vertical stack

**Sub-sections**:

#### A. Message Textarea
- **Layout**: Full width
- **Rows**: 5
- **Placeholder**: "Hey {{name}}, just wanted to reach out..."
- **Behavior**:
  - Controlled component (value bound to state)
  - Real-time updates as user types
  - Supports `{{name}}` placeholder for personalization

#### B. Schedule Row
- **Layout**: Horizontal flex, aligned items
- **Elements**:
  1. **Checkbox**: "Schedule for later"
  2. **Datetime Picker**: `datetime-local` input (conditional)

**Behavior**:
- **Checkbox Unchecked**: Datetime picker hidden
- **Checkbox Checked**: 
  - Datetime picker appears
  - Default value: Tomorrow at current time
  - Format: `YYYY-MM-DDTHH:mm` (local time)
- User can change datetime after checking

#### C. Action Buttons Row
- **Layout**: Horizontal flex, gap between buttons
- **Elements**:
  1. **Preview Button**: "👁 Preview" (secondary style)
  2. **Send/Schedule Button**: 
     - "📨 Send Now (X)" if no schedule
     - "📅 Schedule (X)" if scheduled
     - Shows count of selected contacts

**Button States**:
- **Preview**: Disabled if `!selected.length || !message`
- **Send/Schedule**: Disabled if `!selected.length || !message || sending`
- **Sending**: Shows "⏳ Sending..." and disabled

#### D. Preview List (Conditional)
- **Condition**: Shows when `preview.length > 0`
- **Layout**: Vertical list
- **Header**: "Preview:" (H4)
- **Items**: 
  - Format: "**Name:** Personalized message"
  - One item per preview (max 10 shown)

**Behavior**:
- Appears below action buttons
- Updates when preview is loaded
- Shows first 10 contacts only

#### E. Result Box (Conditional)
- **Condition**: Shows when `result !== null`
- **Layout**: Full width box
- **Visual States**:
  - **Success**: Green background
  - **Error**: Red background (`has-errors` class)

**Content**:
- **Error**: "❌ {error message}"
- **Success**: 
  - "✅ {sent} of {total} {scheduled/sent}"
  - If failed > 0: " ({failed} failed)" in red
  - If rate_limited > 0: " ({rate_limited} rate limited)" in yellow

---

## User Interactions & Behaviors

### 1. Initial Load

**Trigger**: User navigates to Outreach view

**Sequence**:
1. Component mounts
2. `loading = true`
3. GET request to `/contacts?sort=recent`
4. Loads all contacts (for selection)
5. `loading = false`
6. Renders contact list

**Loading State**:
- Shows "Loading..." in contact list area
- Compose panel visible but empty

### 2. Search Contacts

**Trigger**: User types in search input

**Behavior**:
- Filters contacts in real-time (no debounce)
- Case-insensitive search on contact name
- Updates filtered list immediately
- Does NOT trigger API call
- Works with tag filter
- Selection persists (selected contacts remain selected even if filtered out)

**Filter Logic**:
```javascript
contact.name.toLowerCase().includes(search.toLowerCase())
```

### 3. Tag Filter

**Trigger**: User selects tag from dropdown

**Behavior**:
- Filters to show only contacts with selected tag
- Updates filtered list immediately
- Works with search
- "All" shows all contacts
- Does NOT trigger API call
- Selection persists

**Filter Logic**:
```javascript
contact.tags.includes(selectedTag)
```

### 4. Select/Deselect Contact

**Trigger**: User clicks checkbox on contact item

**Behavior**:
1. Toggles contact ID in `selected` array
2. If checked: Adds to array
3. If unchecked: Removes from array
4. Selection count updates
5. Send button text updates with count
6. Preview button enabled/disabled based on selection

**Visual Feedback**:
- Checkbox checked/unchecked
- Selection count updates
- Button states update

### 5. Select All

**Trigger**: User clicks "All" button

**Behavior**:
1. Sets `selected = filtered.map(c => c.id)`
2. All filtered contacts selected
3. Selection count updates
4. All checkboxes checked
5. Buttons enabled (if message exists)

**Note**: Only selects currently filtered contacts, not all contacts

### 6. Clear Selection

**Trigger**: User clicks "Clear" button

**Behavior**:
1. Sets `selected = []`
2. All checkboxes unchecked
3. Selection count becomes 0
4. Buttons disabled
5. Preview list cleared (if exists)
6. Message remains in textarea

### 7. Type Message

**Trigger**: User types in message textarea

**Behavior**:
- Updates `message` state in real-time
- No character limit
- Supports `{{name}}` placeholder
- Preview and Send buttons enable/disable based on:
  - `selected.length > 0` AND `message.trim().length > 0`

### 8. Enable Scheduling

**Trigger**: User checks "Schedule for later" checkbox

**Sequence**:
1. Checkbox checked
2. `scheduleDate` set to tomorrow's date/time (default)
3. Datetime picker appears
4. Send button text changes to "📅 Schedule (X)"
5. User can modify datetime

**Default Schedule Time**:
- Date: Tomorrow (current date + 1 day)
- Time: Current time
- Format: `datetime-local` (YYYY-MM-DDTHH:mm)

### 9. Change Schedule Date

**Trigger**: User changes datetime picker value

**Behavior**:
- Updates `scheduleDate` state
- Send button text remains "📅 Schedule (X)"
- No validation (can set past dates - backend will reject)

### 10. Disable Scheduling

**Trigger**: User unchecks "Schedule for later" checkbox

**Behavior**:
1. Checkbox unchecked
2. `scheduleDate` set to empty string
3. Datetime picker hidden
4. Send button text changes to "📨 Send Now (X)"

### 11. Preview Messages

**Trigger**: User clicks "👁 Preview" button

**Sequence**:
1. Validates: `selected.length > 0 && message.trim().length > 0`
2. If invalid: No action (button disabled)
3. If valid:
   - POST request to `/outreach/preview`
   - Body: `{chat_ids: selected, message}`
4. Backend:
   - Processes first 10 selected contacts
   - Replaces `{{name}}` with contact's first name
   - Returns preview array
5. On success:
   - Updates `preview` state
   - Preview list appears below buttons
6. On error: Logs to console, no preview shown

**Preview Content**:
- Shows first 10 contacts only
- Format: "**Name:** Personalized message"
- Example: "**John:** Hey John, just wanted to reach out..."

**Behavior**:
- Preview updates when selection or message changes
- Old preview remains until new one loaded
- Preview cleared when messages sent

### 12. Send Messages

**Trigger**: User clicks "📨 Send Now" or "📅 Schedule" button

**Sequence**:
1. Validates: `selected.length > 0 && message.trim().length > 0 && !sending`
2. If invalid: No action
3. If valid:
   - `sending = true`
   - Button shows "⏳ Sending..." and disabled
   - `result = null` (clears previous result)
4. Builds request body:
   - `chat_ids`: Selected contact IDs
   - `message`: Message text
   - `delay_seconds`: 60 (hardcoded)
   - `schedule_date`: ISO string (if scheduled)
5. POST request to `/outreach/send`
6. Backend processing (sequential):
   - For each contact:
     - Gets contact entity
     - Replaces `{{name}}` with first name (or "there" if no first name)
     - Sends message (now or scheduled)
     - Waits 60 seconds before next (except last)
     - Handles rate limits
7. On success:
   - `result` updated with stats
   - `selected` cleared
   - `message` cleared
   - `preview` cleared
   - `scheduleDate` remains (if was set)
8. On error:
   - `result` set to `{error: error.message}`
9. `sending = false`

**Result Display**:
- **Success**: "✅ {sent} of {total} {scheduled/sent}"
- **With Failures**: Adds " ({failed} failed)" in red
- **With Rate Limits**: Adds " ({rate_limited} rate limited)" in yellow
- **Error**: "❌ {error message}" in red

**Rate Limit Handling**:
- If rate limited: Waits required time (max 60s), continues
- Rate limited contacts counted separately
- Operation continues despite rate limits

### 13. Personalization

**How It Works**:
- User types `{{name}}` in message
- Backend replaces with contact's first name
- If no first name: Replaces with "there"
- Example:
  - Template: "Hey {{name}}, how are you?"
  - Result: "Hey John, how are you?" (for John Doe)
  - Result: "Hey there, how are you?" (if no first name)

**Preview Behavior**:
- Preview shows personalized messages
- Each contact gets their own personalized version
- Preview limited to first 10 contacts

---

## State Management

### Selection State

**`selected`**: Array of contact IDs
- Toggled by checkbox clicks
- Cleared after successful send
- Persists through filter changes
- Independent of message state

### Message State

**`message`**: String
- Updated as user types
- Cleared after successful send
- Required for preview and send

### Schedule State

**`scheduleDate`**: String (datetime-local format) or empty
- Set when checkbox checked (default: tomorrow)
- Updated when datetime picker changes
- Cleared when checkbox unchecked
- NOT cleared after send (remains set)

### Preview State

**`preview`**: Array of preview objects
- Loaded when Preview button clicked
- Cleared after successful send
- Not cleared when selection/message changes (stale until reload)

### Result State

**`result`**: Object or null
- Set after send operation completes
- Contains: `sent`, `total`, `failed`, `rate_limited`, `error`
- Cleared when new send starts
- Persists until next send

---

## Visual States & Indicators

### Button States

**Preview Button**:
- **Enabled**: `selected.length > 0 && message.trim().length > 0`
- **Disabled**: Gray, not clickable
- **Normal**: "👁 Preview"

**Send/Schedule Button**:
- **Enabled**: `selected.length > 0 && message.trim().length > 0 && !sending`
- **Disabled**: Gray, not clickable
- **Normal**: "📨 Send Now (X)" or "📅 Schedule (X)"
- **Sending**: "⏳ Sending..." (disabled)

### Result Box States

**Success**:
- Green background
- "✅ {sent} of {total} {scheduled/sent}"
- May include failure/rate limit counts

**Error**:
- Red background (`has-errors` class)
- "❌ {error message}"
- Shown for API errors

**Partial Success**:
- Green background with red/yellow text for failures
- Shows sent count + failure/rate limit counts

### Contact Item States

**Selected**:
- Checkbox checked
- No visual highlight (just checkbox)

**Unselected**:
- Checkbox unchecked
- Normal appearance

**Hover**:
- Background color change
- Indicates clickable

---

## Edge Cases & Behaviors

### 1. No Contacts Selected

**Condition**: User tries to preview/send with 0 selections

**Behavior**:
- Buttons disabled
- No action possible
- Preview button shows disabled state

### 2. Empty Message

**Condition**: User tries to preview/send with empty message

**Behavior**:
- Buttons disabled
- No action possible
- Message required

### 3. Schedule Date in Past

**Condition**: User sets schedule date to past time

**Behavior**:
- Frontend: No validation, allows past date
- Backend: `parse_schedule_date` returns `None` for past dates
- Message sent immediately (not scheduled)
- No error shown to user

### 4. Rate Limited During Send

**Condition**: Telegram rate limits during bulk send

**Behavior**:
- Backend catches `FloodWaitError`
- Waits required time (max 60 seconds)
- Continues with next contact
- Rate limited contact marked in results
- Result shows: "({X} rate limited)"

### 5. Send Failure for Some Contacts

**Condition**: Some contacts fail to send (error, invalid ID, etc.)

**Behavior**:
- Failed contact marked in results
- Operation continues with next contact
- Result shows: "({X} failed)" in red
- Success count shows actual sent count

### 6. Preview with Many Contacts

**Condition**: User selects 50 contacts, clicks Preview

**Behavior**:
- Preview shows only first 10 contacts
- Remaining 40 not shown in preview
- All 50 will be sent when Send clicked
- No indication that preview is limited

### 7. Message with No {{name}}

**Condition**: User types message without `{{name}}` placeholder

**Behavior**:
- Message sent as-is (no replacement)
- All contacts receive identical message
- Preview shows same message for all

### 8. Contact Has No First Name

**Condition**: Contact entity has no `first_name` attribute

**Behavior**:
- `{{name}}` replaced with "there"
- Example: "Hey there, how are you?"
- Works for all contacts

### 9. Concurrent Send Attempts

**Condition**: User clicks Send multiple times quickly

**Behavior**:
- `sending` state prevents duplicate requests
- Button disabled during send
- Only first click processes
- Subsequent clicks ignored

### 10. Filter Change During Selection

**Condition**: User selects contacts, then changes filter

**Behavior**:
- Selected contacts remain selected
- Filtered list updates
- Selected contacts may disappear from view (but still selected)
- Selection count unchanged
- Can still send to selected contacts

### 11. Network Error During Send

**Condition**: Network fails during send operation

**Behavior**:
- Error caught, `result` set to `{error: error.message}`
- Result box shows error
- Selection and message NOT cleared
- User can retry

### 12. Partial Send Success

**Condition**: Some messages sent, some failed/rate limited

**Behavior**:
- Result shows: "✅ {sent} of {total} sent"
- Adds failure/rate limit counts if > 0
- Selection cleared (even if some failed)
- User must re-select failed contacts to retry

---

## Scheduling Behavior

### Schedule Date Format

**Frontend**: `datetime-local` format
- User sees: Local date/time picker
- Value: `YYYY-MM-DDTHH:mm` (e.g., "2026-01-24T14:30")

**Backend Conversion**:
- Converts to ISO format with timezone
- Validates: Must be in future
- If past: Treated as send now

### Default Schedule Time

**When Checkbox Checked**:
- Date: Tomorrow (current date + 1 day)
- Time: Current time
- Example: If today is Jan 23, 2:30 PM → Jan 24, 2:30 PM

### Schedule Validation

**Frontend**: None (allows any date/time)

**Backend**:
- Parses ISO datetime
- Checks if in future
- If past: Returns `None`, sends immediately
- If future: Schedules message

---

## Rate Limiting

### Delay Between Messages

**Fixed Delay**: 60 seconds between each message
- Applied automatically
- Not configurable by user
- Helps avoid Telegram rate limits

### Rate Limit Handling

**During Send**:
- If rate limited: Waits required time (max 60s)
- Continues with next contact
- Rate limited contact counted separately
- Result shows rate limited count

**User Experience**:
- Send operation takes longer if rate limited
- Progress not shown (no progress bar)
- User sees result when complete

---

## Data Flow

### Load Contacts
```
User Action → load() → GET /contacts?sort=recent
  → Update contacts state → Render list
```

### Preview Messages
```
User Action → loadPreview() → POST /outreach/preview
  → Backend: Personalize first 10
  → Update preview state → Show preview list
```

### Send Messages
```
User Action → send() → POST /outreach/send
  → Backend: For each contact (sequential)
    ├─> Get entity
    ├─> Personalize message
    ├─> Send (now or scheduled)
    ├─> Wait 60s (except last)
    └─> Handle errors
  → Return results
  → Update result state
  → Clear selection/message/preview
```

---

## Summary

**Outreach View Layout**:
- Two-column: Contacts (left, 350px) + Compose (right, flex)
- Filters: Search + Tag filter (real-time)
- Selection: Checkboxes with All/Clear actions
- Compose: Message textarea + Schedule + Actions
- Preview: Shows personalized messages (first 10)
- Results: Success/error feedback

**Key Behaviors**:
- Real-time filtering (search + tag)
- Bulk selection with All/Clear
- Message personalization with `{{name}}`
- Scheduling with datetime picker
- Preview before sending (first 10 contacts)
- Sequential sending with 60s delay
- Rate limit handling with automatic retry
- Result feedback with success/failure counts
