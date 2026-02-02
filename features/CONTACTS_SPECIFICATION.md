# Contacts View - Layout & Behavior Specification

## Overview

The Contacts view provides a two-column layout for managing Telegram contacts. Left column shows a list of contacts with checkboxes for bulk selection, right column shows detailed information for the selected contact.

---

## Layout Structure

### Visual Hierarchy
```
┌─────────────────────────────────────────────────────────────┐
│ Contacts View Container                                      │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Toolbar (Horizontal, flex-wrap)                         │ │
│ │ ┌──────────┬──────────┬──────┬──────┬──────┬──────────┐ │ │
│ │ │ Title    │ Cache    │Refresh│Search│Tag   │ Sort    │ │ │
│ │ │ (Left)   │ Badge    │Button │Input │Filter│Dropdown │ │ │
│ │ └──────────┴──────────┴──────┴──────┴──────┴──────────┘ │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Info Banner (Conditional)                                │ │
│ │ "💡 X contacts have never been messaged..."             │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Error/Warning Banners (Conditional)                       │ │
│ │ - Error: Red banner                                      │ │
│ │ - Warning: Yellow banner                                 │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Bulk Actions Bar (Conditional - when contacts selected) │ │
│ │ ┌──────┬──────────┬──────────┬──────────┬──────────┐   │ │
│ │ │Count │Tag       │Apply Tag │Delete    │Clear     │   │ │
│ │ │      │Dropdown  │Button    │Button    │Button    │   │ │
│ │ └──────┴──────────┴──────────┴──────────┴──────────┘   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Two-Column Layout                                        │ │
│ │ ┌──────────────────────┬──────────────────────────────┐ │ │
│ │ │ Contacts List        │ Detail Panel                 │ │ │
│ │ │ (Left, scrollable)   │ (Right, 350px width)        │ │ │
│ │ │                      │                              │ │ │
│ │ │ ┌──────────────────┐ │ ┌──────────────────────────┐ │ │ │
│ │ │ │ List Header      │ │ │ Contact Name (H3)        │ │ │ │
│ │ │ │ [☑] Name | Date │ │ │ Username (if exists)     │ │ │ │
│ │ │ │      | Tags      │ │ │                          │ │ │ │
│ │ │ └──────────────────┘ │ │ Tags Section             │ │ │ │
│ │ │                      │ │ - Tag list with ×        │ │ │ │
│ │ │ ┌──────────────────┐ │ │ - ✨ AI Suggest button   │ │ │ │
│ │ │ │ Contact Row      │ │ │ - Add tag dropdown      │ │ │ │
│ │ │ │ [☐] Name         │ │ │                          │ │ │ │
│ │ │ │      Username    │ │ │ Stats Section            │ │ │ │
│ │ │ │      Date        │ │ │ - Last contact date      │ │ │ │
│ │ │ │      Tags        │ │ │ - Unread count           │ │ │ │
│ │ │ └──────────────────┘ │ │                          │ │ │ │
│ │ │ ... (one per contact)│ │ │ 💬 Open Chat Button     │ │ │ │
│ │ │                      │ │ │ (Full width)           │ │ │ │
│ │ └──────────────────────┘ │ └──────────────────────────┘ │ │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Layout

### 1. Toolbar

**Layout**: Horizontal flex container, wraps on small screens

**Elements** (left to right):
1. **Title**: "👥 Contacts (X)" - Shows total contact count
2. **Cache Badge**: "📦 Cached {age}" or "✨ Fresh" - Shows cache status
3. **Refresh Button**: "🔄" or "⏳" - Refreshes contact list
4. **Search Input**: Text input, placeholder "Search..."
5. **Tag Filter Dropdown**: "All Tags" + list of available tags
6. **Sort Dropdown**: "Recent" / "A-Z" / "Unread"

**Behavior**:
- All elements visible at all times
- Search and filters work in real-time (no submit button)
- Refresh button shows "⏳" when refreshing

### 2. Info Banner

**Condition**: Shows if `neverContacted > 0`

**Content**: "💡 {count} contacts have never been messaged. Consider cleaning up your contact list."

**Behavior**:
- Appears below toolbar
- Blue info banner styling
- Always visible when condition is true

### 3. Error/Warning Banners

**Error Banner**:
- Condition: `error !== null`
- Content: "Failed to load contacts: {error message}"
- Red banner styling
- Appears below info banner

**Warning Banner**:
- Condition: `warning !== null`
- Content: "⚠️ {warning message}"
- Yellow banner styling
- Appears below error banner (if exists)

### 4. Bulk Actions Bar

**Condition**: Shows when `selectedIds.length > 0`

**Layout**: Horizontal bar with elements

**Elements** (left to right):
1. **Count**: "{selectedIds.length} selected"
2. **Tag Dropdown**: "Add tag..." + list of available tags
3. **Apply Tag Button**: "Apply Tag" - Disabled if no tag selected
4. **Delete Button**: "🗑️ Delete" or "⏳" - Disabled when deleting
5. **Clear Button**: "Clear" - Deselects all

**Behavior**:
- Appears below banners
- Blue background (accent color)
- Disappears when no contacts selected

### 5. Contacts List (Left Column)

**Layout**: Scrollable list with header row

**List Header** (fixed at top):
- Grid layout: 4 columns
- Column 1: Checkbox (30px width)
- Column 2: "Name" (flex: 1)
- Column 3: "Last Contact" (100px width)
- Column 4: "Tags" (150px width)

**Contact Row**:
- Grid layout: Same 4 columns as header
- Row 1: Checkbox
- Row 2: Contact info (name + username)
- Row 3: Last contact date
- Row 4: Tags (first 2 tags + "+X more" if more)

**Visual States**:
- **Selected** (detail open): Blue left border (3px), highlighted background
- **Never Contacted**: Dimmed appearance (opacity 0.7)
- **Bulk Selected**: Checkbox checked
- **Hover**: Background color change

**Row Content**:
- **Name**: Bold, full name
- **Username**: Smaller text, gray color, "@username" format
- **Date**: 
  - "Today" if `days_ago === 0`
  - "{X}d ago" if `days_ago > 0`
  - "Never" in red if `days_ago === null`
- **Tags**: First 2 tags displayed, "+X" if more exist

### 6. Detail Panel (Right Column)

**Condition**: Shows when `selected !== null`

**Layout**: Fixed width 350px, scrollable if content overflows

**Sections**:

**1. Header**:
- Contact name (H3)
- Username (if exists): "@username" in gray

**2. Tags Section**:
- Section header: "Tags" + "✨ AI Suggest" button (right-aligned)
- Tag list: Tags displayed with × button (removable)
- Add tag row: Dropdown + "Add" button (appears when tag selected)

**3. Stats Section**:
- Section header: "Stats"
- Last contact: "Last contact: {date}" or "Never"
- Unread count: "{count} unread messages" (only if > 0)

**4. Open Chat Button**:
- Full width button
- "💬 Open Chat"
- Opens chat panel

---

## User Interactions & Behaviors

### 1. Initial Load

**Trigger**: User navigates to Contacts view

**Sequence**:
1. Component mounts
2. `loading = true`
3. GET request to `/contacts?sort=recent`
4. If cache exists and valid (< 7 days old):
   - Returns cached contacts immediately
   - `cached: true` in response
5. If no cache or expired:
   - Fetches contacts from Telegram API
   - Returns fresh contacts
   - `cached: false` in response
6. `loading = false`
7. Renders contact list

**Loading State**:
- Shows "Loading contacts..." in list area
- Toolbar remains visible
- Detail panel hidden

### 2. Search

**Trigger**: User types in search input

**Behavior**:
- Filters contacts in real-time (no debounce)
- Case-insensitive search on contact name
- Updates filtered list immediately
- Does NOT trigger API call
- Works with other filters (tag filter, sort)

**Filter Logic**:
```javascript
contact.name.toLowerCase().includes(search.toLowerCase())
```

### 3. Tag Filter

**Trigger**: User selects tag from dropdown

**Behavior**:
- Filters to show only contacts with selected tag
- Updates filtered list immediately
- Works with search and sort
- "All Tags" shows all contacts
- Does NOT trigger API call

**Filter Logic**:
```javascript
contact.tags.includes(selectedTag)
```

### 4. Sort Change

**Trigger**: User changes sort dropdown

**Behavior**:
1. Sort state updates
2. `useEffect` triggers (dependency on `sort`)
3. Calls `load()` with new sort parameter
4. API returns sorted contacts
5. List updates with new order

**Sort Options**:
- **Recent**: Sorted by `last_message_date` descending (newest first)
- **A-Z**: Sorted alphabetically by name
- **Unread**: Sorted by `unread` count descending

### 5. Refresh

**Trigger**: User clicks "🔄 Refresh" button

**Sequence**:
1. Button click calls `load(true)`
2. `refreshing = true` (button shows "⏳")
3. GET request to `/contacts?sort={sort}&refresh=true`
4. Forces fresh fetch from Telegram (bypasses cache)
5. Updates contacts list
6. `refreshing = false`
7. Cache badge updates to "✨ Fresh"

**Visual Feedback**:
- Button shows "⏳" during refresh
- List may show loading state
- Cache badge updates after completion

### 6. Select Contact (Open Detail)

**Trigger**: User clicks on contact row (name, date, or tags area)

**Behavior**:
1. Sets `selected = contact` (contact object)
2. Detail panel appears on right
3. Contact row highlights (blue left border, selected class)
4. Previous selection cleared
5. Bulk selection (`selectedIds`) remains unchanged

**Note**: Checkbox click does NOT open detail (uses `stopPropagation`)

### 7. Checkbox Selection (Bulk)

**Trigger**: User clicks checkbox on contact row

**Behavior**:
1. Toggles contact in `selectedIds` array
2. If checked: Adds to array
3. If unchecked: Removes from array
4. Does NOT open detail panel
5. Bulk actions bar appears/disappears based on count
6. Header checkbox updates (checked if all filtered selected)

**Header Checkbox**:
- Click: Selects/deselects all filtered contacts
- State: Checked if `selectedIds.length === filtered.length && filtered.length > 0`
- Independent of detail panel selection

### 8. Add Tag to Contact

**Trigger**: User selects tag from dropdown in detail panel and clicks "Add"

**Sequence**:
1. User selects tag from "Add tag..." dropdown
2. "Add" button appears
3. User clicks "Add"
4. PUT request to `/contacts/{id}` with new tags array
5. Updates local state (both list and detail panel)
6. Dropdown resets to empty
7. Tag appears in tag list

**Behavior**:
- Tag dropdown only shows tags not already on contact
- "Add" button only appears when tag is selected
- Tag immediately visible in list and detail

### 9. Remove Tag from Contact

**Trigger**: User clicks × button on tag in detail panel

**Sequence**:
1. User clicks × on tag
2. PUT request to `/contacts/{id}` with updated tags (tag removed)
3. Updates local state
4. Tag disappears from list and detail

**Behavior**:
- Immediate update (optimistic)
- No confirmation dialog
- Tag removed from both list view and detail panel

### 10. AI Suggest Tag

**Trigger**: User clicks "✨ AI Suggest" button in detail panel

**Sequence**:
1. POST request to `/contacts/{id}/suggest-tag`
2. AI analyzes contact and suggests tag
3. If tag not already on contact:
   - Adds tag automatically
   - Shows alert: "AI suggested: {tag}"
4. If tag already exists:
   - Shows alert: "AI suggested: {tag}" (but doesn't add)

**Behavior**:
- Button may show loading state (not explicitly implemented)
- Alert shown regardless of whether tag was added
- Tag appears in list if added

### 11. Bulk Tag Application

**Trigger**: User selects tag in bulk actions bar and clicks "Apply Tag"

**Sequence**:
1. User selects multiple contacts (checkboxes)
2. Bulk actions bar appears
3. User selects tag from dropdown
4. User clicks "Apply Tag"
5. POST request to `/contacts/bulk-tag` with all selected IDs
6. Tag added to all selected contacts
7. `selectedIds` cleared
8. Bulk actions bar disappears
9. Tags update in list view

**Behavior**:
- "Apply Tag" button disabled if no tag selected
- Tag added to contacts (even if they already have it - no duplicates)
- Selection cleared after operation
- All contacts update visually

### 12. Bulk Delete

**Trigger**: User clicks "🗑️ Delete" button in bulk actions bar

**Sequence**:
1. User has contacts selected
2. User clicks "🗑️ Delete"
3. Confirmation dialog: "Delete {count} contacts from Telegram? This cannot be undone."
4. If confirmed:
   - `deleting = true` (button shows "⏳")
   - POST request to `/contacts/delete` with selected IDs
   - On success:
     - Alert: "Deleted {count} contacts"
     - Contacts removed from list
     - `selectedIds` cleared
     - `selected` cleared (if deleted contact was selected)
   - On error:
     - Alert: "Failed to delete: {error}"
5. `deleting = false`

**Behavior**:
- Requires confirmation (cannot be undone)
- Button disabled during deletion
- Contacts disappear from list immediately on success
- Detail panel closes if selected contact was deleted

### 13. Clear Selection

**Trigger**: User clicks "Clear" button in bulk actions bar

**Behavior**:
1. Sets `selectedIds = []`
2. All checkboxes unchecked
3. Bulk actions bar disappears
4. Detail panel remains open (if contact was selected)

### 14. Open Chat from Detail

**Trigger**: User clicks "💬 Open Chat" button in detail panel

**Behavior**:
1. Calls `onOpenChat(selected.id, selected.name)`
2. Chat panel opens with this contact
3. Detail panel remains visible
4. User can return to contacts view

---

## State Management

### Contact Selection States

**Two Independent Selections**:
1. **Detail Selection** (`selected`): Single contact object for detail panel
2. **Bulk Selection** (`selectedIds`): Array of contact IDs for bulk operations

**Behavior**:
- These are independent - you can have detail open AND bulk selection
- Clicking row opens detail (doesn't affect bulk selection)
- Clicking checkbox toggles bulk selection (doesn't affect detail)
- Clearing bulk selection doesn't close detail panel

### Filtering & Sorting

**Filter Chain**:
1. **Tag Filter**: Filters by tag (if not "all")
2. **Search Filter**: Filters by name (if search text exists)
3. **Sort**: Sorts filtered results

**Applied Order**:
```javascript
contacts
  .filter(tagFilter)      // First: tag filter
  .filter(searchFilter)   // Then: search filter
  .sort(sortFunction)     // Finally: sort
```

**Real-time Updates**:
- Search: Updates immediately as user types
- Tag Filter: Updates immediately on selection
- Sort: Triggers API call (reloads data)

---

## Visual States & Indicators

### Contact Row States

**Normal State**:
- White/dark background
- No border
- Hover: Background color change

**Selected State** (detail open):
- Blue left border (3px)
- Highlighted background
- Same contact as `selected`

**Never Contacted State**:
- Dimmed appearance (opacity 0.7)
- "Never" text in red color
- Visual indicator that contact hasn't been messaged

**Bulk Selected State**:
- Checkbox checked
- No visual change to row (unless also selected for detail)

### Detail Panel States

**Empty State**:
- Panel hidden when `selected === null`
- No placeholder shown

**Populated State**:
- Shows contact information
- All sections visible
- Tags section shows existing tags or empty state

### Loading States

**Initial Load**:
- "Loading contacts..." text in list area
- Toolbar visible
- Detail panel hidden

**Refresh**:
- Refresh button shows "⏳"
- List may show loading (not explicitly)
- Toolbar remains functional

**Delete**:
- Delete button shows "⏳"
- Button disabled
- Other actions still available

---

## Edge Cases & Behaviors

### 1. No Contacts

**Condition**: Empty contact list

**Behavior**:
- List shows "Loading contacts..." during load
- After load: Empty list (no specific empty state message)
- Detail panel hidden
- Stats show 0

### 2. Rate Limited

**Condition**: Telegram API returns rate limit error

**Behavior**:
- If cached data exists: Returns cached data with warning
- Warning banner: "⚠️ Rate limited. Using cached data. Try refresh in X minutes."
- If no cache: Error banner shown, empty list

### 3. Search with No Results

**Condition**: Search/filter returns no matches

**Behavior**:
- List shows no rows
- Header row still visible
- Detail panel remains open (if contact was selected)
- No "no results" message

### 4. Contact Deleted While Selected

**Condition**: Contact is deleted (via bulk delete) while detail panel is open

**Behavior**:
- Contact removed from list
- Detail panel closes (`selected = null`)
- `selectedIds` cleared

### 5. Tag Already Exists

**Condition**: User tries to add tag that contact already has

**Behavior**:
- Tag dropdown doesn't show existing tags (filtered out)
- Cannot add duplicate tag
- No error shown (prevented by UI)

### 6. Concurrent Updates

**Condition**: User updates contact in detail panel while list is refreshing

**Behavior**:
- Local state updates immediately (optimistic)
- API call in background
- If refresh happens, may overwrite local changes
- No conflict resolution

### 7. Very Long Contact Names

**Condition**: Contact name exceeds display width

**Behavior**:
- Text truncated with ellipsis (`text-overflow: ellipsis`)
- Full name visible on hover (if tooltip implemented)
- Username also truncated if long

### 8. Many Tags

**Condition**: Contact has 5+ tags

**Behavior**:
- List view: Shows first 2 tags + "+X more" indicator
- Detail panel: Shows all tags
- "+X more" text in gray, smaller font

### 9. Sort Change During Load

**Condition**: User changes sort while initial load in progress

**Behavior**:
- `useEffect` triggers new load
- Previous request may complete but will be ignored
- New sort applied
- List updates with new order

### 10. Filter Change

**Condition**: User changes tag filter or search

**Behavior**:
- List updates immediately (client-side filter)
- No API call
- Detail panel remains open (if selected contact still in filtered list)
- If selected contact filtered out: Detail panel remains open (no auto-close)

---

## Responsive Behavior

### Desktop (> 1000px)
- Two-column layout: List (left) + Detail (right)
- Detail panel: 350px fixed width
- List: Takes remaining space

### Mobile/Tablet (< 1000px)
- Single column layout
- Detail panel: Hidden or modal overlay
- List: Full width
- Toolbar: Wraps to multiple rows

---

## Data Flow

### Load Contacts
```
User Action → load() → GET /contacts?sort={sort}
  → Cache Check → Return Cached OR Fetch Fresh
  → Update State → Render List
```

### Update Contact
```
User Action → updateContact() → PUT /contacts/{id}
  → Update Local State (List + Detail)
  → Optimistic Update
```

### Bulk Tag
```
User Action → bulkAddTag() → POST /contacts/bulk-tag
  → Update All Selected Contacts
  → Clear Selection
```

### Delete Contacts
```
User Action → deleteSelected() → Confirm Dialog
  → POST /contacts/delete
  → Remove from List
  → Clear Selection
```

---

## Summary

**Contacts View Layout**:
- Two-column: List (left) + Detail (right)
- Toolbar with filters and search
- Bulk actions bar when contacts selected
- Info/warning banners for important messages

**Key Behaviors**:
- Real-time search and tag filtering (client-side)
- Sort triggers API call
- Independent detail selection and bulk selection
- Optimistic updates for tag changes
- Confirmation required for delete
- Cache for 7 days, refresh forces fresh fetch
