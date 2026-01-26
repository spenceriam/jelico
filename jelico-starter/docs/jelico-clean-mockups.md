# Jelico — Clean UI Mockups

## Design Philosophy

**Feel like Claude.ai / Open WebUI, not a "designed" product.**

- System fonts, not fancy typography
- One subtle accent color, used sparingly
- Minimal borders, subtle shadows
- The UI disappears — content is the hero
- No gradients, no glows, no "branding"
- If you have to notice the design, it's too much

**Reference points:**
- Claude.ai's clean chat interface
- Open WebUI's functional simplicity
- Linear's understated dark mode
- macOS system preferences

---

## Color Tokens (Simple)

```
Light Mode:
  Background     #ffffff
  Surface        #f9fafb
  Border         #e5e7eb
  Text           #111827
  Text Secondary #6b7280
  Accent         #d97706  (warm amber, like Claude)

Dark Mode:
  Background     #18181b
  Surface        #27272a  
  Border         #3f3f46
  Text           #fafafa
  Text Secondary #a1a1aa
  Accent         #f59e0b
```

**Typography:** System stack. That's it.
```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
```

---

## 1. Main Interface (Dark Mode)

Clean. Familiar. The sidebar is just organization, not decoration.

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                         │
│  ┌─────────────────┐  ┌─────────────────────────────────────────────────────────────┐  │
│  │                 │  │                                                             │  │
│  │  Jelico         │  │  jelico-app · main                    Claude Sonnet 4  ▾   │  │
│  │                 │  │      ↑ workspace/branch                    ↑ model picker  │  │
│  │  ───────────────│  ├─────────────────────────────────────────────────────────────┤  │
│  │                 │  │                                                             │  │
│  │  + New chat     │  │   Auto   Explore   Execute   Plan   Review                 │  │
│  │                 │  │                      ───────                                │  │
│  │  Today          │  │                     ↑ active (just underline, nothing fancy)│  │
│  │   Landing page  │  │                                                             │  │
│  │   API docs      │  ├─────────────────────────────────────────────────────────────┤  │
│  │                 │  │                                                             │  │
│  │  Yesterday      │  │                                                             │  │
│  │   Debug auth    │  │                                                             │  │
│  │   Research...   │  │      Create a landing page for my SaaS product             │  │
│  │                 │  │      "Flowboard" - a project management tool with AI        │  │
│  │  ───────────────│  │                                                             │  │
│  │                 │  │                                          ← user message     │  │
│  │  Agents         │  │                                             right-aligned   │  │
│  │                 │  │                                             slightly gray bg│  │
│  │   Research      │  │                                                             │  │
│  │   ● 65%         │  │  ─────────────────────────────────────────────────────────  │  │
│  │                 │  │                                                             │  │
│  │   Code Review   │  │  I'll create a landing page for Flowboard.                 │  │
│  │   ✓ Done        │  │                                                             │  │
│  │                 │  │  Using: write_file ✓                                        │  │
│  │  ───────────────│  │         ↑ tool use, compact, muted                          │  │
│  │                 │  │                                                             │  │
│  │  ⚙ Settings     │  │  index.html                                                │  │
│  │                 │  │  ┌─────────────────────────────────────────────────────┐   │  │
│  │                 │  │  │ <!DOCTYPE html>                                     │   │  │
│  │                 │  │  │ <html lang="en">                                    │   │  │
│  │                 │  │  │ <head>                                              │   │  │
│  │                 │  │  │   <title>Flowboard</title>                          │   │  │
│  │                 │  │  │   ...                                               │   │  │
│  │                 │  │  └─────────────────────────────────────────────────────┘   │  │
│  │                 │  │       ↑ code block, simple border, mono font               │  │
│  │                 │  │                                                             │  │
│  │                 │  │  The page includes a hero section, feature cards,          │  │
│  │                 │  │  and a call-to-action.                                     │  │
│  │                 │  │                                                             │  │
│  │                 │  ├─────────────────────────────────────────────────────────────┤  │
│  │                 │  │                                                             │  │
│  │                 │  │  Message Jelico...                               ↑  ●      │  │
│  │                 │  │                                                  attach send│  │
│  │                 │  │                                                             │  │
│  └─────────────────┘  └─────────────────────────────────────────────────────────────┘  │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘

Notes:
- No logo mark, just "Jelico" in text
- Sidebar is plain list, no fancy cards
- Agent status is just text + percentage
- Mode selector is tabs with underline, not pills
- Input is simple, like Claude.ai
- Everything breathes but nothing screams
```

---

## 2. With Artifacts/Canvas (Split View)

Canvas appears when there's something to show. Simple split.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                                      │
│  ┌──────────┐  ┌──────────────────────────────────────┐  ┌─────────────────────────────────────────┐│
│  │          │  │                                      │  │                                         ││
│  │ Sidebar  │  │  Chat                                │  │  index.html                       ✕    ││
│  │          │  │                                      │  │                                         ││
│  │ (same)   │  │  ┌──────────────────────────────┐   │  │  Code   Preview                        ││
│  │          │  │  │ Create a landing page...     │   │  │  ────                                   ││
│  │          │  │  └──────────────────────────────┘   │  │                                         ││
│  │          │  │                                      │  │  1  <!DOCTYPE html>                    ││
│  │          │  │  I'll create that for you.          │  │  2  <html lang="en">                   ││
│  │          │  │                                      │  │  3  <head>                             ││
│  │          │  │  write_file ✓                        │  │  4    <meta charset="UTF-8">          ││
│  │          │  │                                      │  │  5    <title>Flowboard</title>        ││
│  │          │  │  The landing page is ready.         │  │  6    <script src="..."></script>     ││
│  │          │  │                                      │  │  7  </head>                            ││
│  │          │  │                                      │  │  8  <body>                             ││
│  │          │  │                                      │  │  9    <nav>...</nav>                   ││
│  │          │  │                                      │  │ 10    <main>                           ││
│  │          │  │                                      │  │ 11      <section class="hero">        ││
│  │          │  │                                      │  │ 12        ...                          ││
│  │          │  │                                      │  │                                         ││
│  │          │  │                                      │  ├─────────────────────────────────────────┤│
│  │          │  │                                      │  │                                         ││
│  │          │  ├──────────────────────────────────────┤  │  v1  v2                         Diff   ││
│  │          │  │                                      │  │  ──                                     ││
│  │          │  │  Message Jelico...              ● │  │  │  ↑ version pills, current underlined  ││
│  │          │  │                                      │  │                                         ││
│  └──────────┘  └──────────────────────────────────────┘  └─────────────────────────────────────────┘│
│                                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────────────────────┘

Notes:
- Canvas is just another panel, no special treatment
- Tab bar for Code/Preview is simple text tabs
- Line numbers in muted color
- Version selector is minimal
- Close button is just ✕, not a fancy icon
```

---

## 3. Provider Setup

First launch or settings. Dead simple.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                                                                             │
│                              Add a provider                                 │
│                                                                             │
│               Connect an AI service to start using Jelico.                 │
│                                                                             │
│                                                                             │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │                                                                 │    │
│     │  Anthropic                                                      │    │
│     │  Claude models                                                  │    │
│     │                                                                 │    │
│     ├─────────────────────────────────────────────────────────────────┤    │
│     │                                                                 │    │
│     │  OpenAI                                                         │    │
│     │  GPT models                                                     │    │
│     │                                                                 │    │
│     ├─────────────────────────────────────────────────────────────────┤    │
│     │                                                                 │    │
│     │  Ollama                                                         │    │
│     │  Local models                                                   │    │
│     │                                                                 │    │
│     ├─────────────────────────────────────────────────────────────────┤    │
│     │                                                                 │    │
│     │  OpenRouter                                                     │    │
│     │  Multiple providers                                             │    │
│     │                                                                 │    │
│     ├─────────────────────────────────────────────────────────────────┤    │
│     │                                                                 │    │
│     │  Custom                                                         │    │
│     │  OpenAI-compatible API                                          │    │
│     │                                                                 │    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│                              Skip for now                                   │
│                                                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Notes:
- Just a list, not a grid of cards
- Each option is a row, hover to highlight
- No icons, no colors, just text
- "Skip for now" is a text link, not a button
```

---

## 4. Anthropic Configuration

Form. That's it.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ← Back                                                                     │
│                                                                             │
│                              Anthropic                                      │
│                                                                             │
│                                                                             │
│     API Key                                                                 │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │ sk-ant-api03-                                                   │    │
│     └─────────────────────────────────────────────────────────────────┘    │
│     Get your key at console.anthropic.com                                  │
│                                                                             │
│                                                                             │
│     Name (optional)                                                         │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │ Personal                                                        │    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│                                                                             │
│     Default model                                                           │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │ Claude Sonnet 4                                              ▾ │    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│                                                                             │
│                                        Test connection     Save            │
│                                                                             │
│                                                                             │
│     🔒 Stored in system keychain                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Notes:
- Standard form inputs
- Help text below fields, not inline
- Two buttons: ghost "Test" and filled "Save"
- Security note at bottom, muted
```

---

## 5. Spawn Agent

Simple modal. Nothing fancy.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  New agent                                                             ✕   │
│                                                                             │
│  ───────────────────────────────────────────────────────────────────────   │
│                                                                             │
│  Name                                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Research assistant                                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Task                                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Research competitor pricing for project management tools.          │   │
│  │ Create a summary document with pricing tiers and features.         │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Skills                                                                     │
│                                                                             │
│    Researcher ✓     Writer ✓     Coder     Analyst     Planner             │
│                                                                             │
│  Options                                                                    │
│                                                                             │
│    ☑ Run in background                                                     │
│    ☐ Use worktree (isolate file changes)                                   │
│                                                                             │
│  ───────────────────────────────────────────────────────────────────────   │
│                                                                             │
│                                              Cancel          Start         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Notes:
- Skills are just text with checkmarks, not pills
- Checkboxes are native-looking
- Minimal dividers
- "Start" is the only accent-colored element
```

---

## 6. Agent Status (Sidebar Section)

Just text and a progress indicator.

```
  Agents
  
    Research assistant
    ● Searching for competitor data...
    ████████████░░░░░░░░ 60%
    
    Code review
    ✓ Complete · Found 3 issues
    
    ─────────────────────────
    
    + New agent

Notes:
- Green dot for running, checkmark for done
- Progress bar is thin, simple
- Current action shown in muted text
- No cards, no borders, just list
```

---

## 7. Agent Detail (Expanded)

Click an agent to see more. Still simple.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  Research assistant                                               ● Running │
│                                                                             │
│  ───────────────────────────────────────────────────────────────────────   │
│                                                                             │
│  Task                                                                       │
│  Research competitor pricing for project management tools.                 │
│  Create a summary document with pricing tiers and features.                │
│                                                                             │
│  ───────────────────────────────────────────────────────────────────────   │
│                                                                             │
│  Progress                                                                   │
│                                                                             │
│  ████████████████████████░░░░░░░░░░░░ 65%                                  │
│                                                                             │
│  ✓ Found 8 competitors                                                     │
│  ✓ Gathered pricing data                                                   │
│  ● Creating comparison document                                            │
│  ○ Final review                                                            │
│                                                                             │
│  ───────────────────────────────────────────────────────────────────────   │
│                                                                             │
│  Activity                                                                   │
│                                                                             │
│  > Reading Monday.com pricing page...                                      │
│  > Extracted 3 pricing tiers                                               │
│  > Moving to Asana...                                                      │
│                                                                             │
│  ───────────────────────────────────────────────────────────────────────   │
│                                                                             │
│  2,341 tokens · 2m 34s                          Pause     Stop             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Notes:
- Status badge is just colored dot + text
- Progress steps use simple symbols: ✓ ● ○
- Activity log is monospace, terminal-like but not styled
- Stats and actions at bottom
```

---

## 8. Command Palette

Standard command palette. Nothing special.

```
                ┌───────────────────────────────────────────────────────┐
                │                                                       │
                │  Search commands...                                   │
                │                                                       │
                ├───────────────────────────────────────────────────────┤
                │                                                       │
                │  Agents                                               │
                │                                                       │
                │    New agent                                   ⌘⇧A   │
                │    View agents                                 ⌘⇧G   │
                │                                                       │
                │  Mode                                                 │
                │                                                       │
                │    Switch to Execute                           ⌘3    │
                │    Switch to Plan                              ⌘4    │
                │                                                       │
                │  Workspace                                            │
                │                                                       │
                │    Open folder...                              ⌘O    │
                │    New worktree                                ⌘⇧W   │
                │                                                       │
                └───────────────────────────────────────────────────────┘

Notes:
- Simple list with sections
- Keyboard shortcuts right-aligned, muted
- Arrow keys to navigate, enter to select
- No icons
```

---

## 9. Mode Selector

Just tabs. Underline for active.

```
    Auto     Explore     Execute     Plan     Review
                          ───────
                          
    ↑ Active mode has underline
    ↑ Tab to cycle, or click
    ↑ No pills, no backgrounds, just text
```

---

## 10. Worktree Tabs

Appear below workspace name when you have multiple.

```
    jelico-app
    
    main     feature/auth     agent/research ●
    ────                                     ↑ dot = agent working
    ↑ active has underline
    
    Click to switch. Right-click for merge options.
```

---

## 11. MCP Settings

Just a list of servers with toggles.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ← Settings                           MCP Servers                           │
│                                                                             │
│  Servers extend Jelico with external tools.                                │
│                                                                             │
│  ───────────────────────────────────────────────────────────────────────   │
│                                                                             │
│  Built-in                                                                   │
│                                                                             │
│    Filesystem                                               ○──●  Running  │
│    Read and write files                                                     │
│    read_file · write_file · list_directory                                 │
│                                                                             │
│    Git                                                      ○──●  Running  │
│    Version control operations                                               │
│    git_status · git_diff · git_commit                                      │
│                                                                             │
│    Web Search                                               ●──○  Off      │
│    Search with Brave (requires API key)                                    │
│                                          Configure                          │
│                                                                             │
│  ───────────────────────────────────────────────────────────────────────   │
│                                                                             │
│  Custom                                                          + Add     │
│                                                                             │
│    Notion                                                   ○──●  Running  │
│    npx -y @anthropic/mcp-server-notion                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Notes:
- Toggle switches are simple
- Tools shown as comma-separated text
- Server command shown in mono, muted
- "Configure" link for servers needing setup
```

---

## 12. Model Picker Dropdown

Click the model name in header.

```
                              ┌─────────────────────────────────┐
                              │                                 │
                              │  Anthropic (Personal)           │
                              │    Claude Sonnet 4        ✓    │
                              │    Claude Opus 4                │
                              │    Claude Haiku 3.5             │
                              │                                 │
                              │  OpenAI (Work)                  │
                              │    GPT-4o                       │
                              │    GPT-4 Turbo                  │
                              │                                 │
                              │  Ollama                         │
                              │    llama3.1:70b                 │
                              │                                 │
                              │  ───────────────────────────   │
                              │  Manage providers...            │
                              │                                 │
                              └─────────────────────────────────┘

Notes:
- Grouped by provider
- Checkmark for current selection
- "Manage providers" at bottom
- No icons, no badges, just names
```

---

## Design Summary

### What it is:
- Clean like Claude.ai
- Functional like Open WebUI
- Quiet like Linear

### What it isn't:
- Branded
- Decorated
- Attention-seeking

### The only accent color usage:
- Active/selected states
- Primary action buttons ("Save", "Start")
- Running status indicators

### Everything else:
- Grays
- Black and white
- System fonts
- Native-feeling controls

---

## Implementation Notes

```css
/* That's basically it */

:root {
  --bg: #18181b;
  --surface: #27272a;
  --border: #3f3f46;
  --text: #fafafa;
  --text-muted: #a1a1aa;
  --accent: #f59e0b;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 14px;
  line-height: 1.5;
}

/* Borders are subtle */
border: 1px solid var(--border);

/* Buttons are simple */
.btn-primary {
  background: var(--accent);
  color: black;
  padding: 8px 16px;
  border-radius: 6px;
}

/* No shadows except for dropdowns/modals */
.dropdown {
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

/* That's it. Ship it. */
```

---

The UI should feel invisible. Like it was always there. Like it's obvious.
