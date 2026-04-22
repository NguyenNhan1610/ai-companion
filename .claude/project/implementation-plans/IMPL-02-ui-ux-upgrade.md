# IMPL-02: UI/UX Dashboard Upgrade

**Date:** 2026-04-09
**Method:** Incremental refactor
**Source:** User request + ui-ux-pro-max design system
**Total tasks:** 14
**Critical path:** T01 → T03 → T05 → T08 → T10

---

## Design System

### Color Palette (Coding Bootcamp — Terminal Dark)

Derived from ui-ux-pro-max `dark mode coding` palette, refined for GitHub-dark feel:

```css
:root {
  /* Surfaces */
  --bg-app:       #020617;   /* deepest background (OLED-friendly) */
  --bg-sidebar:   #0B1120;   /* sidebar surface */
  --bg-panel:     #0F172A;   /* main panel surfaces */
  --bg-card:      #1E293B;   /* cards, widgets, inline blocks */
  --bg-elevated:  #1A2332;   /* hover states, selected items */
  --bg-input:     #0F172A;   /* input fields */

  /* Borders & Dividers */
  --border:       #1E293B;   /* subtle structural borders */
  --border-active: #334155;  /* active/focus borders */
  --resize-handle: #334155;  /* drag handles */
  --resize-hover:  #475569;  /* drag handle hover */

  /* Text */
  --text-primary:   #F8FAFC;  /* primary text — 15.4:1 on bg-app */
  --text-secondary: #94A3B8;  /* secondary text — 7.2:1 on bg-panel */
  --text-muted:     #475569;  /* muted/placeholder — 3.5:1 on bg-panel */
  --text-inverse:   #0F172A;  /* text on accent backgrounds */

  /* Accents */
  --accent-blue:    #3B82F6;  /* links, active tabs, primary actions */
  --accent-green:   #22C55E;  /* success, connected, NEW tag */
  --accent-orange:  #F97316;  /* warnings, REVISION tag */
  --accent-red:     #EF4444;  /* errors, destructive, INCOMPLETE */
  --accent-purple:  #A78BFA;  /* search, QUESTION tag */
  --accent-cyan:    #22D3EE;  /* info, agent events */

  /* Functional */
  --tab-active:     #3B82F6;  /* active tab indicator */
  --tab-inactive:   #475569;  /* inactive tab text */
  --scrollbar:      #1E293B;
  --scrollbar-hover: #334155;

  /* Status dots */
  --status-connected:    #22C55E;
  --status-disconnected: #EF4444;
  --status-connecting:   #F97316;
}
```

### Typography

```css
:root {
  --font-mono: "JetBrains Mono", "Fira Code", "SF Mono", "Cascadia Code", Consolas, monospace;
  --font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;

  /* Scale: 10 / 11 / 12 / 13 / 14 / 16 / 20 / 24 */
  --text-xs:   10px;
  --text-sm:   11px;
  --text-base: 13px;  /* body */
  --text-md:   14px;
  --text-lg:   16px;
  --text-xl:   20px;

  --leading-tight: 1.3;
  --leading-normal: 1.5;
  --leading-relaxed: 1.6;
}
```

### Spacing (4px base grid)

```
4  8  12  16  20  24  32  40  48  64
```

### Icons

Use **Lucide React** — consistent 1.5px stroke, 24px default. No emojis.

---

## Layout Redesign

### Current (Phase 1-2)

```
[Sidebar 220px] [ChatFeed (flex)]
                [Terminal (docked bottom)]
```

### Target

```
┌────────────┬──────────────────────┬─────────────────────────┐
│  Sidebar   │  BlockNote Editor    │  Chat │ Terminal  [tabs] │
│  200px     │  (resizable)         │  (resizable)            │
│            │                      │                         │
│  Files     │  Document content    │  Event widgets          │
│  tree      │  with BlockNote      │  OR                     │
│  only      │                      │  xterm.js terminal      │
│            │                      │                         │
│  ●         │                      │                         │
│ connected  │                      │                         │
└────────────┴──────────────────────┴─────────────────────────┘
                   ↕ resize handle        ↕ resize handle
```

**Key changes:**
1. Sidebar: file tree only + minimal status dot (no filters, no stats)
2. Center: BlockNote editor (always visible, shows welcome when no file open)
3. Right: Tabbed panel — "Chat" tab (event feed) + "Terminal" tab (xterm.js)
4. Resizable columns via drag handles between panels
5. Bottom terminal removed — moves to tab

---

## Tasks

### T01: Install Lucide React + remove emojis

**Priority:** P0 | **Track:** design

Replace all emoji usage across widgets with Lucide icons:

| Current Emoji | Lucide Icon | Component |
|---------------|-------------|-----------|
| 🧑 (user) | `User` | UserPrompt.tsx |
| 📄 (file) | `File` | FileRead.tsx, ReadGroup.tsx |
| 📁 (folder) | `Folder` / `FolderOpen` | FileTree.tsx |
| 📝 (doc) | `FileText` | FileTree.tsx |
| 📊 (data) | `FileCode` | FileTree.tsx |
| 🖼 (image) | `Image` | FileTree.tsx |
| 📋 (clipboard) | `ClipboardList` | FileTree.tsx |
| 🔍 (search) | `Search` | SearchResult.tsx, SearchGroup.tsx |
| 📂 (folder) | `FolderSearch` | SearchResult.tsx |
| ⚙️ (agent) | `Bot` | AgentStart.tsx |
| ✅ (complete) | `CheckCircle` | AgentResult.tsx |
| ⚡ (job) | `Zap` | JobStatus.tsx |
| ❓ (question) | `HelpCircle` | QuestionWidget.tsx |
| ☀️/🌙 (theme) | `Sun` / `Moon` | Sidebar.tsx |

**Install:** `npm install lucide-react`

**Files:** All widget .tsx files, FileTree.tsx, Sidebar.tsx

---

### T02: Update color palette + CSS variables

**Priority:** P0 | **Track:** design

Replace current CSS variables in `index.css` with the design system palette above. Update all component inline styles to use the new token names.

Key changes:
- `--bg-primary` → `--bg-app`
- `--bg-secondary` → `--bg-sidebar` / `--bg-panel`
- `--bg-tertiary` → `--bg-elevated`
- Add new tokens: `--bg-input`, `--border-active`, `--resize-handle`, `--tab-active`
- Light theme: derive from slate-50/100/200 base with same semantic names

**Files:** `src/index.css`, all components using `var(--bg-*)`

---

### T03: New layout — 3-column with resize handles

**Priority:** P0 | **Track:** layout

Rewrite `App.tsx` with three-column resizable layout:

```
[Sidebar fixed 200px] | [Editor flex] | [Right Panel flex]
```

**Resize implementation** (no library — CSS + pointer events):

```tsx
// ResizeHandle component
function ResizeHandle({ onResize, direction = "horizontal" }) {
  // mousedown → track delta → update parent width state
  // cursor: col-resize (horizontal) or row-resize (vertical)
  // 4px wide, full height, bg on hover
}
```

**State:**
- `editorWidth: number` (persisted to localStorage, default 50%)
- `rightPanelWidth: number` (persisted, default 40%)
- Min widths: sidebar 160px, editor 300px, right panel 280px

**Files:** `src/App.tsx`, new `src/layout/ResizeHandle.tsx`

---

### T04: Sidebar redesign — files only + status dot

**Priority:** P0 | **Track:** sidebar

Strip Sidebar to minimal:

```
┌────────────────────┐
│ AI Companion  ● ☀  │  ← header: title + status dot + theme toggle
├────────────────────┤
│ PROJECT FILES      │  ← section label
│ ▼ adr/             │
│   ADR-01-redis.md  │
│ ▼ fdr/             │
│   FDR-03-cache.md  │
│ ▶ implementation…  │
│ ▶ todos/           │
│ ▶ cascades/        │
│ ▶ knowledge/       │
│ ▶ traces/          │
└────────────────────┘
```

**Remove:**
- Filter section (Prompts/Tools/Agents/Jobs/System toggles)
- Stats section (event count, session duration)
- Search input
- "Show Editor" button

**Keep:**
- Theme toggle (Sun/Moon icon)
- Connected status dot (3px circle in header, no label)
- File tree (improved, see T05)

**Files:** `src/layout/Sidebar.tsx` (rewrite), `src/App.tsx` (remove filter state)

---

### T05: Improved FileTree

**Priority:** P1 | **Track:** sidebar

Enhance file tree from T04:

- Lucide icons: `Folder`/`FolderOpen` for dirs, `FileText` for .md, `FileCode` for .yaml, `Image` for .svg
- Indentation: 12px per level (was 16px — tighter)
- Active file: left border 2px `--accent-blue` + `--bg-elevated` background
- Hover: `--bg-elevated` background, 150ms transition
- Truncate long names with `text-overflow: ellipsis`
- Auto-expand directory when a file inside it is opened
- Click directory: toggle collapse (existing)
- Click file: open in editor (existing) + switch to editor if on another tab

**Files:** `src/editor/FileTree.tsx`

---

### T06: Tabbed right panel — Chat + Terminal

**Priority:** P0 | **Track:** layout

Create tabbed container for the right panel:

```tsx
function TabbedPanel({ activeTab, onTabChange, children }) {
  // Tab bar: "Chat" | "Terminal"
  // Active tab: --accent-blue underline (2px), --text-primary
  // Inactive tab: no underline, --tab-inactive
  // Tab bar height: 32px, border-bottom: 1px --border
}
```

**Tab bar design:**
```
┌──────────────────────────────────────┐
│  Chat        Terminal                │
│  ────                                │  ← 2px blue underline on active
├──────────────────────────────────────┤
│                                      │
│  (tab content fills remaining space) │
│                                      │
└──────────────────────────────────────┘
```

- Keyboard: `Ctrl+1` = Chat tab, `Ctrl+2` = Terminal tab
- Terminal tab lazy-mounts xterm.js on first switch (avoid connection until needed)
- Chat tab: the existing ChatFeed (without filters — those are removed)
- Persist active tab in localStorage

**Files:** New `src/layout/TabbedPanel.tsx`, update `src/App.tsx`

---

### T07: Move ChatFeed to right panel tab

**Priority:** P1 | **Track:** feed

Adapt ChatFeed for the tabbed panel context:

- Remove the connection status bar at top (status dot is in sidebar now)
- Keep: auto-scroll, scroll-to-bottom button, event grouping
- Add compact event count in tab label: "Chat (42)"
- Filter state moves to local ChatFeed state (simple toggle for reads visibility)
- Right-click on event → "Copy" context menu

**Files:** `src/feed/ChatFeed.tsx`

---

### T08: Move Terminal to right panel tab

**Priority:** P1 | **Track:** terminal

Adapt TerminalPanel for the tabbed panel:

- Remove the toolbar header (Clear/Close buttons move to tab-level actions)
- Status dot in tab label: "Terminal ●"
- Resize: FitAddon responds to panel resize events
- Lazy mount: only connect WebSocket when Terminal tab first activates
- Keep alive when switching to Chat tab (don't disconnect)

**Files:** `src/terminal/TerminalPanel.tsx`

---

### T09: Editor welcome state

**Priority:** P2 | **Track:** editor

When no file is open, the editor panel shows a welcome screen:

```
┌────────────────────────────────┐
│                                │
│     AI Companion Dashboard     │
│                                │
│     Select a file from the     │
│     sidebar to start editing   │
│                                │
│     Quick actions:             │
│     [+ New ADR]                │
│     [+ New FDR]                │
│     [+ New IMPL]              │
│                                │
│     Keyboard shortcuts:        │
│     Ctrl+S  Save               │
│     Ctrl+B  Toggle sidebar     │
│     Ctrl+1  Chat tab           │
│     Ctrl+2  Terminal tab       │
│                                │
└────────────────────────────────┘
```

**Files:** `src/editor/DocumentEditor.tsx`

---

### T10: Resize handle polish

**Priority:** P1 | **Track:** layout

Design specs for resize handles:

- Width: 4px (hit area 12px via padding)
- Default: transparent (invisible)
- Hover: `--resize-hover` (#475569) with 150ms fade-in
- Active/dragging: `--accent-blue` (#3B82F6)
- Cursor: `col-resize`
- Double-click: reset to default widths
- Snap: snap to 50%/50% when within 10px of center
- Persist widths to localStorage

**Files:** `src/layout/ResizeHandle.tsx`

---

### T11: Remove bottom bar

**Priority:** P2 | **Track:** layout

Remove the bottom status bar from App.tsx. Its functions are relocated:
- Sidebar toggle → keyboard shortcut Ctrl+B only (sidebar is always visible by default)
- Terminal toggle → now a tab, always accessible
- Event count → shown in Chat tab label
- Connected/Disconnected → status dot in sidebar header

**Files:** `src/App.tsx`

---

### T12: Scrollbar + micro-interaction polish

**Priority:** P2 | **Track:** design

- Scrollbar: 6px wide (was 8px), `--scrollbar` thumb, `--scrollbar-hover` on hover
- Hover transitions: all interactive elements get `transition: background 150ms ease`
- Focus rings: 2px `--accent-blue` outline on keyboard focus, hidden on mouse focus (`:focus-visible`)
- Selection color: `--accent-blue` at 30% opacity
- Tab underline: animate slide on tab switch (120ms)

**Files:** `src/index.css`, various components

---

### T13: Light theme update

**Priority:** P3 | **Track:** design

Update `[data-theme="light"]` tokens to match new palette structure:

```css
[data-theme="light"] {
  --bg-app:       #FAFBFC;
  --bg-sidebar:   #F1F5F9;
  --bg-panel:     #FFFFFF;
  --bg-card:      #F8FAFC;
  --bg-elevated:  #F1F5F9;
  --bg-input:     #FFFFFF;
  --border:       #E2E8F0;
  --border-active: #CBD5E1;
  --text-primary:   #0F172A;
  --text-secondary: #475569;
  --text-muted:     #94A3B8;
  /* Accents stay the same */
}
```

**Files:** `src/index.css`

---

### T14: Update App.tsx filter removal

**Priority:** P1 | **Track:** cleanup

Remove all filter-related state and logic from App.tsx since sidebar no longer has filters:

- Remove `FilterState` type and `filters` state
- Remove `filteredEvents` useMemo — pass raw events to ChatFeed
- ChatFeed internally handles "show reads" toggle only (simple local state)
- Remove `Sidebar` filter props

**Files:** `src/App.tsx`, `src/layout/Sidebar.tsx`, `src/feed/ChatFeed.tsx`

---

## Dependency DAG

```
T01 (icons) ─────────────────────────────┐
T02 (colors) ────────────────────────────┤
                                          ├→ T12 (polish)
T03 (3-col layout) ──┬→ T04 (sidebar) ──┤
                      │                   ├→ T13 (light theme)
                      ├→ T06 (tabs) ─────┤
                      │   ├→ T07 (chat)  │
                      │   └→ T08 (term)  │
                      │                   │
                      ├→ T10 (resize)    │
                      └→ T11 (bottom bar)│
                                          │
T04 → T05 (file tree) ──────────────────┘
T04 → T14 (filter removal)
T03 → T09 (welcome state)
```

**Critical path:** T01 + T02 → T03 → T06 → T07/T08 → T12

**Parallel tracks:**
- Track A: T01 + T02 (design tokens)
- Track B: T03 + T10 (layout + resize)
- Track C: T04 + T05 (sidebar)
- Track D: T06 + T07 + T08 (tabs)
- Track E: T09 + T11 + T12 + T13 + T14 (polish)

---

## Anti-Patterns to Avoid (from ui-ux-pro-max)

- No emojis as structural icons — use Lucide SVG only
- No `cursor: default` on clickable elements — always `cursor: pointer`
- No instant transitions — all state changes get 150ms ease minimum
- No light-mode-only design — test both themes independently
- No layout shift on hover/press — use transform/opacity only
- No color-only meaning — pair color with icon or text label
- No `z-index` guessing — define scale: 0/10/20/40/100

## Verification

1. `npm run build` succeeds
2. Three-column layout renders with resize handles
3. Sidebar shows file tree only + status dot
4. Right panel has Chat/Terminal tabs
5. Terminal works in tab (not bottom dock)
6. No emojis in any widget
7. Color contrast ≥ 4.5:1 for all text
8. Both dark and light themes work
9. localStorage persists: panel widths, active tab, theme
