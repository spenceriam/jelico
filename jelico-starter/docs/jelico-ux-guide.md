# Jelico UX Guide

## The Complete User Experience

---

## Table of Contents

1. [First Launch Experience](#first-launch-experience)
2. [Main Interface](#main-interface)
3. [Provider Setup](#provider-setup)
4. [Core User Flows](#core-user-flows)
5. [Modes & Skills](#modes--skills)
6. [Sub-Agent Experience](#sub-agent-experience)
7. [Worktree Workflow](#worktree-workflow)
8. [MCP Configuration](#mcp-configuration)
9. [Artifacts & Canvas](#artifacts--canvas)
10. [Settings & Preferences](#settings--preferences)

---

## First Launch Experience

### Philosophy: Zero to Productive in 60 Seconds

No lengthy onboarding. No tutorial carousels. Get the user doing something valuable immediately.

### Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                      │
│                         Welcome to Jelico                            │
│                                                                      │
│                    Your AI productivity partner                      │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                                                                 │ │
│  │   To get started, add an AI provider:                          │ │
│  │                                                                 │ │
│  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │ │
│  │   │  Anthropic  │  │   OpenAI    │  │   Ollama    │           │ │
│  │   │   Claude    │  │   GPT-4o    │  │   Local     │           │ │
│  │   └─────────────┘  └─────────────┘  └─────────────┘           │ │
│  │                                                                 │ │
│  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │ │
│  │   │ OpenRouter  │  │   Gemini    │  │    Other    │           │ │
│  │   │  Any Model  │  │   Google    │  │   Custom    │           │ │
│  │   └─────────────┘  └─────────────┘  └─────────────┘           │ │
│  │                                                                 │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│                    [ Skip - I'll do this later ]                     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Provider Setup (e.g., Anthropic Selected)

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  ← Back                    Anthropic Setup                           │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                                                                 │ │
│  │   API Key                                                       │ │
│  │   ┌──────────────────────────────────────────────────────────┐ │ │
│  │   │ sk-ant-api03-••••••••••••••••••••••••••••••••••••••••   │ │ │
│  │   └──────────────────────────────────────────────────────────┘ │ │
│  │   Get your API key at console.anthropic.com →                  │ │
│  │                                                                 │ │
│  │   Name (optional)                                               │ │
│  │   ┌──────────────────────────────────────────────────────────┐ │ │
│  │   │ Personal                                                  │ │ │
│  │   └──────────────────────────────────────────────────────────┘ │ │
│  │                                                                 │ │
│  │   Default Model                                                 │ │
│  │   ┌──────────────────────────────────────────────────────────┐ │ │
│  │   │ Claude Sonnet 4              ▼                           │ │ │
│  │   └──────────────────────────────────────────────────────────┘ │ │
│  │                                                                 │ │
│  │                                                                 │ │
│  │              [ Test Connection ]    [ Save & Continue ]         │ │
│  │                                                                 │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│                                                                      │
│   ✓ Key stored securely in system keychain                          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Success → Immediately Usable

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                      │
│                              ✓ Ready!                                │
│                                                                      │
│              You're all set. Here are some things to try:            │
│                                                                      │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │  "Help me write a project proposal for..."                   │   │
│   └─────────────────────────────────────────────────────────────┘   │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │  "Research the latest trends in..."                          │   │
│   └─────────────────────────────────────────────────────────────┘   │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │  "Analyze this spreadsheet and..."                           │   │
│   └─────────────────────────────────────────────────────────────┘   │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │  Open a folder to work with files                            │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│                         [ Start chatting ]                           │
│                                                                      │
│   Tip: Press ⌘K anytime for the command palette                     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Main Interface

### Layout Overview

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│ ┌──────────────────┐ ┌───────────────────────────────────────────────────────────┐ │
│ │                  │ │ Header                                                     │ │
│ │                  │ ├───────────────────────────────────────────────────────────┤ │
│ │                  │ │                                                           │ │
│ │     Sidebar      │ │                                                           │ │
│ │                  │ │                      Main Panel                           │ │
│ │  - Workspaces    │ │                                                           │ │
│ │  - Chats         │ │                   (Chat + Artifacts)                      │ │
│ │  - Agents        │ │                                                           │ │
│ │  - Settings      │ │                                                           │ │
│ │                  │ │                                                           │ │
│ │                  │ ├───────────────────────────────────────────────────────────┤ │
│ │                  │ │ Input                                                     │ │
│ └──────────────────┘ └───────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────┘
```

### Detailed Main Interface

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                          │
│ ┌─────────────────┐  ┌─────────────────────────────────────────────────────────────────┐│
│ │                 │  │                                                                  ││
│ │ ┌─────────────┐ │  │  ┌─ Workspace ──────────────────────────────────────────────┐   ││
│ │ │ 📁 Projects │ │  │  │  📁 jelico-app                                           │   ││
│ │ │ ▼           │ │  │  │  ┌─ main ─┐ ┌─ feature/auth ─┐ ┌─ + ─┐                  │   ││
│ │ │  jelico-app │ │  │  └──────────────────────────────────────────────────────────┘   ││
│ │ │  my-blog    │ │  │                                                                  ││
│ │ │  research   │ │  │  ┌─ Mode ────────────────────────────────────────────────────┐  ││
│ │ └─────────────┘ │  │  │ [Auto] [Explore] [Execute] [Plan] [Review]    Tab to cycle│  ││
│ │                 │  │  └───────────────────────────────────────────────────────────┘  ││
│ │ ┌─────────────┐ │  │                                                                  ││
│ │ │ 💬 Chats    │ │  │  ┌─ Model ─────────────────────────────────────────────────────┐││
│ │ │ ▼           │ │  │  │ Claude Sonnet 4 · Anthropic                            ▼   │││
│ │ │  Project... │ │  │  └─────────────────────────────────────────────────────────────┘││
│ │ │  Research..  │ │  │                                                                  ││
│ │ │  Debug the..│ │  │  ╭─────────────────────────────────────────────────────────────╮││
│ │ │  + New chat │ │  │  │                                                             │││
│ │ └─────────────┘ │  │  │   Welcome! I'm Jelico, your AI productivity partner.        │││
│ │                 │  │  │                                                             │││
│ │ ┌─────────────┐ │  │  │   I can help you with:                                      │││
│ │ │ 🤖 Agents   │ │  │  │   • Writing documents, emails, articles                     │││
│ │ │             │ │  │  │   • Research and analysis                                   │││
│ │ │  (none)     │ │  │  │   • Working with code and files                            │││
│ │ │             │ │  │  │   • Planning projects                                       │││
│ │ └─────────────┘ │  │  │                                                             │││
│ │                 │  │  │   What would you like to do?                                │││
│ │                 │  │  │                                                             │││
│ │                 │  │  ╰─────────────────────────────────────────────────────────────╯││
│ │                 │  │                                                                  ││
│ │ ┌─────────────┐ │  │  ┌───────────────────────────────────────────────────────────┐  ││
│ │ │ ⚙️ Settings │ │  │  │ 📎  What do you want to do?                        🎤  ➤ │  ││
│ │ └─────────────┘ │  │  └───────────────────────────────────────────────────────────┘  ││
│ │                 │  │  Enter to send · Tab to cycle modes · ⌘K commands              ││
│ └─────────────────┘  └─────────────────────────────────────────────────────────────────┘│
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### With Artifacts Panel Open

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                                   │
│ ┌────────────┐ ┌────────────────────────────────────┐ ┌────────────────────────────────────────┐ │
│ │            │ │                                    │ │                                        │ │
│ │  Sidebar   │ │          Chat Panel                │ │         Artifacts Panel                │ │
│ │            │ │                                    │ │                                        │ │
│ │ (compact)  │ │  ╭──────────────────────────────╮  │ │  ┌─ Files ─────────────────────────┐  │ │
│ │            │ │  │ You: Create a landing page   │  │ │  │ index.html  styles.css  app.js │  │ │
│ │            │ │  │ for my SaaS product          │  │ │  └─────────────────────────────────┘  │ │
│ │ Projects▼  │ │  ╰──────────────────────────────╯  │ │                                        │ │
│ │            │ │                                    │ │  ┌─ View ──────────────────────────┐  │ │
│ │ Chats ▼    │ │  ╭──────────────────────────────╮  │ │  │ [Code]  [Split]  [Preview]      │  │ │
│ │            │ │  │ ✍️ Writer skill activated     │  │ │  └─────────────────────────────────┘  │ │
│ │ Agents ▼   │ │  │                              │  │ │                                        │ │
│ │  └ Research│ │  │ I'll create a modern landing │  │ │  ┌─────────────────────────────────┐  │ │
│ │    ●running│ │  │ page for you. Here's the     │  │ │  │ <!DOCTYPE html>                 │  │ │
│ │            │ │  │ HTML structure:              │  │ │  │ <html lang="en">                │  │ │
│ │            │ │  │                              │  │ │  │ <head>                          │  │ │
│ │            │ │  │ ```html                      │  │ │  │   <title>SaaS Product</title>   │  │ │
│ │            │ │  │ (collapsed - see canvas →)   │  │ │  │   <script src="https://cdn...   │  │ │
│ │            │ │  │ ```                          │  │ │  │ </head>                         │  │ │
│ │            │ │  │                              │  │ │  │ <body class="bg-gradient...     │  │ │
│ │            │ │  ╰──────────────────────────────╯  │ │  │   <nav class="container...      │  │ │
│ │            │ │                                    │ │  │     ...                         │  │ │
│ │            │ │                                    │ │  └─────────────────────────────────┘  │ │
│ │            │ │  ┌──────────────────────────────┐  │ │                                        │ │
│ │            │ │  │ 📎  Make the hero section... │  │ │  ┌─ v1 ──┐ ┌─ v2 ──┐  [Diff]        │ │
│ │            │ │  └──────────────────────────────┘  │ │  └────────┘ └────────┘                │ │
│ │            │ │                                    │ │                                        │ │
│ └────────────┘ └────────────────────────────────────┘ └────────────────────────────────────────┘ │
│                                                                                                   │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Provider Setup

### Accessing Provider Settings

**Method 1: Command Palette**
```
⌘K → "providers" → Enter
```

**Method 2: Settings**
```
Sidebar → Settings → Providers
```

**Method 3: Model Dropdown**
```
Click model selector → "Manage providers..."
```

### Provider Management Screen

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                          │
│  ← Settings                        Providers                                             │
│                                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐│
│  │                                                                                      ││
│  │  Your Providers                                                        [ + Add ]    ││
│  │                                                                                      ││
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐   ││
│  │  │  ✓  Anthropic (Personal)                                                     │   ││
│  │  │      Claude Sonnet 4, Claude Opus 4, Claude Haiku                           │   ││
│  │  │      Status: Connected                                         [ Edit ] [···]│   ││
│  │  └─────────────────────────────────────────────────────────────────────────────┘   ││
│  │                                                                                      ││
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐   ││
│  │  │  ✓  OpenAI (Work)                                                            │   ││
│  │  │      GPT-4o, GPT-4 Turbo, GPT-3.5                                            │   ││
│  │  │      Status: Connected                                         [ Edit ] [···]│   ││
│  │  └─────────────────────────────────────────────────────────────────────────────┘   ││
│  │                                                                                      ││
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐   ││
│  │  │  ○  Ollama (Local)                                              [ Enable ]   │   ││
│  │  │      llama3.1:70b, codestral, mistral                                        │   ││
│  │  │      Status: Not running                                       [ Edit ] [···]│   ││
│  │  └─────────────────────────────────────────────────────────────────────────────┘   ││
│  │                                                                                      ││
│  └─────────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐│
│  │                                                                                      ││
│  │  Default Provider                                                                    ││
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐   ││
│  │  │  Anthropic (Personal) · Claude Sonnet 4                               ▼     │   ││
│  │  └─────────────────────────────────────────────────────────────────────────────┘   ││
│  │                                                                                      ││
│  │  Smart Routing                                                          [ ON ]      ││
│  │  Automatically select best model for task                                           ││
│  │                                                                                      ││
│  └─────────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Add Provider Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                          │
│  ← Back                         Add Provider                                             │
│                                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐│
│  │                                                                                      ││
│  │  Choose a provider type                                                              ││
│  │                                                                                      ││
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                      ││
│  │  │                 │  │                 │  │                 │                      ││
│  │  │   ◆ Anthropic   │  │   ◇ OpenAI     │  │   ◇ Google      │                      ││
│  │  │     Claude      │  │     GPT        │  │     Gemini      │                      ││
│  │  │                 │  │                 │  │                 │                      ││
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘                      ││
│  │                                                                                      ││
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                      ││
│  │  │                 │  │                 │  │                 │                      ││
│  │  │   ◇ Ollama      │  │   ◇ OpenRouter  │  │   ◇ Custom      │                      ││
│  │  │     Local       │  │     Any Model   │  │     OpenAI API  │                      ││
│  │  │                 │  │                 │  │                 │                      ││
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘                      ││
│  │                                                                                      ││
│  └─────────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                          │
│  ───────────────────────────────────────────────────────────────────────────────────────│
│                                                                                          │
│  Anthropic Configuration                                                                 │
│                                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐│
│  │                                                                                      ││
│  │  Display Name                                                                        ││
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐   ││
│  │  │ Work Account                                                                 │   ││
│  │  └─────────────────────────────────────────────────────────────────────────────┘   ││
│  │                                                                                      ││
│  │  API Key                                                                             ││
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐   ││
│  │  │ sk-ant-api03-                                                                │   ││
│  │  └─────────────────────────────────────────────────────────────────────────────┘   ││
│  │  Don't have a key? Get one at console.anthropic.com →                               ││
│  │                                                                                      ││
│  │  Default Model                                                                       ││
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐   ││
│  │  │ Claude Sonnet 4 (claude-sonnet-4-20250514)                             ▼    │   ││
│  │  └─────────────────────────────────────────────────────────────────────────────┘   ││
│  │                                                                                      ││
│  │                                                                                      ││
│  │                         [ Test Connection ]        [ Save ]                          ││
│  │                                                                                      ││
│  └─────────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Ollama (Local) Setup

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                          │
│  ← Back                         Configure Ollama                                         │
│                                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐│
│  │                                                                                      ││
│  │  Ollama runs AI models locally on your machine.                                      ││
│  │                                                                                      ││
│  │  Status:  ● Running at localhost:11434                                              ││
│  │                                                                                      ││
│  │  ───────────────────────────────────────────────────────────────────────────────    ││
│  │                                                                                      ││
│  │  Server URL                                                                          ││
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐   ││
│  │  │ http://localhost:11434                                                       │   ││
│  │  └─────────────────────────────────────────────────────────────────────────────┘   ││
│  │                                                                                      ││
│  │  Available Models                                                    [ Refresh ]    ││
│  │                                                                                      ││
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐   ││
│  │  │  ✓  llama3.1:70b          70B params     39 GB                              │   ││
│  │  │  ✓  codestral:latest      22B params     12 GB                              │   ││
│  │  │  ✓  mistral:latest        7B params       4 GB                              │   ││
│  │  │  ○  llama3.1:8b           8B params       5 GB         [ Pull ]             │   ││
│  │  └─────────────────────────────────────────────────────────────────────────────┘   ││
│  │                                                                                      ││
│  │  Default Model                                                                       ││
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐   ││
│  │  │ llama3.1:70b                                                           ▼    │   ││
│  │  └─────────────────────────────────────────────────────────────────────────────┘   ││
│  │                                                                                      ││
│  │                                              [ Cancel ]        [ Save ]              ││
│  │                                                                                      ││
│  └─────────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                          │
│  ℹ️  Don't have Ollama? Install it at ollama.ai →                                        │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Model Selector (In-Chat)

```
┌───────────────────────────────────────────────────┐
│  Model                                       ▼    │
└───────────────────────────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────────┐
│                                                    │
│  Anthropic (Personal)                              │
│  ├─ Claude Sonnet 4          ← recommended        │
│  ├─ Claude Opus 4            💎 most capable      │
│  └─ Claude Haiku 3.5         ⚡ fastest            │
│                                                    │
│  OpenAI (Work)                                     │
│  ├─ GPT-4o                                         │
│  ├─ GPT-4 Turbo                                    │
│  └─ GPT-3.5 Turbo                                  │
│                                                    │
│  Ollama (Local)                                    │
│  ├─ llama3.1:70b             🔒 private            │
│  └─ codestral                🔒 private            │
│                                                    │
│  ───────────────────────────────────────────────  │
│  Manage providers...                               │
│                                                    │
└───────────────────────────────────────────────────┘
```

---

## Core User Flows

### Flow 1: Simple Question (No Tools)

```
User Journey:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. User types: "What's the best way to structure a React project?"

2. Jelico responds immediately (no skill activation needed)
   
   ╭─────────────────────────────────────────────────────────────────╮
   │                                                                  │
   │  There are several popular approaches to structuring React      │
   │  projects. Here's what I recommend based on project size:       │
   │                                                                  │
   │  For small projects...                                          │
   │  For medium projects...                                         │
   │  For large projects...                                          │
   │                                                                  │
   ╰─────────────────────────────────────────────────────────────────╯

3. No artifacts, no tools, just helpful response

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Flow 2: Writing Task

```
User Journey:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. User types: "Write a blog post about AI productivity tools"

2. Jelico auto-detects intent:
   
   ┌─────────────────────────────────────────────────────────────────┐
   │  ✍️ Writer skill activated                                       │
   └─────────────────────────────────────────────────────────────────┘

3. Response streams in chat, artifact appears on right:

   ┌─────────────────────────────┐  ┌────────────────────────────────┐
   │                             │  │  blog-post.md                  │
   │  I'll write that blog post  │  │  ──────────────────────────    │
   │  for you. Creating a        │  │  # The Rise of AI Productivity │
   │  comprehensive article...   │  │  # Tools: A 2025 Guide         │
   │                             │  │                                │
   │  The post covers:           │  │  The landscape of AI-powered   │
   │  • Current landscape        │  │  productivity tools has        │
   │  • Top tools reviewed       │  │  transformed dramatically...   │
   │  • Future predictions       │  │                                │
   │                             │  │  ## What Makes These Tools     │
   │                             │  │  ## Different                  │
   │                             │  │                                │
   └─────────────────────────────┘  └────────────────────────────────┘

4. User can:
   - Edit in the canvas
   - Export as .md, .docx, .pdf
   - Continue refining: "Make the intro more punchy"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Flow 3: Research Task

```
User Journey:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. User types: "Research the competitive landscape for project management tools"

2. Skills activate:
   
   ┌─────────────────────────────────────────────────────────────────┐
   │  🔍 Researcher skill activated                                   │
   │  ✍️ Writer skill activated (for report)                          │
   └─────────────────────────────────────────────────────────────────┘

3. Jelico works (shows progress):

   ╭─────────────────────────────────────────────────────────────────╮
   │                                                                  │
   │  I'll research this for you. Here's my approach:                │
   │                                                                  │
   │  ┌─ Research Plan ────────────────────────────────────────────┐ │
   │  │  1. Identify major players           ✓ complete             │ │
   │  │  2. Gather feature comparisons       ● in progress          │ │
   │  │  3. Analyze pricing models           ○ pending              │ │
   │  │  4. Find market share data           ○ pending              │ │
   │  │  5. Synthesize into report           ○ pending              │ │
   │  └────────────────────────────────────────────────────────────┘ │
   │                                                                  │
   │  Searching: "project management software market 2025"...        │
   │                                                                  │
   ╰─────────────────────────────────────────────────────────────────╯

4. Final output: Research report in artifacts panel with citations

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Flow 4: Code Task (with Workspace)

```
User Journey:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. User has opened a workspace: ~/projects/my-app

2. User types: "Add authentication to this app"

3. Skills and mode update:
   
   ┌─────────────────────────────────────────────────────────────────┐
   │  💻 Coder skill activated                                        │
   │  Mode: Auto → Execute (this requires changes)                    │
   └─────────────────────────────────────────────────────────────────┘

4. Jelico explores first:

   ╭─────────────────────────────────────────────────────────────────╮
   │                                                                  │
   │  Let me understand your project structure first...              │
   │                                                                  │
   │  📁 Analyzed:                                                    │
   │  • Framework: Next.js 14 with App Router                        │
   │  • Auth: None currently                                         │
   │  • Database: Prisma with PostgreSQL                             │
   │                                                                  │
   │  I recommend NextAuth.js for authentication. This will add:     │
   │  • OAuth (Google, GitHub)                                       │
   │  • Email/password                                               │
   │  • Session management                                           │
   │                                                                  │
   │  Should I proceed?                                              │
   │                                                                  │
   │  [ Yes, implement it ]  [ Let me specify details ]              │
   │                                                                  │
   ╰─────────────────────────────────────────────────────────────────╯

5. User clicks "Yes, implement it"

6. Jelico works with real-time file updates visible in artifacts:

   ┌─────────────────────────────┐  ┌────────────────────────────────┐
   │                             │  │  ┌─ Files Modified ──────────┐ │
   │  Implementing auth...       │  │  │ + auth.ts                 │ │
   │                             │  │  │ + [...nextauth]/route.ts  │ │
   │  ✓ Created auth config     │  │  │ ~ middleware.ts            │ │
   │  ✓ Added API routes        │  │  │ ~ .env.example             │ │
   │  ● Updating middleware...   │  │  └────────────────────────────┘ │
   │  ○ Adding protected pages  │  │                                │
   │                             │  │  // auth.ts                   │
   │                             │  │  import NextAuth from "next..│
   │                             │  │  import Google from "next-au..│
   │                             │  │                                │
   │                             │  │  export const { handlers, ... │
   │                             │  │                                │
   └─────────────────────────────┘  └────────────────────────────────┘

7. Completion:

   ╭─────────────────────────────────────────────────────────────────╮
   │                                                                  │
   │  ✓ Authentication implemented!                                  │
   │                                                                  │
   │  Changes made:                                                  │
   │  • Created /lib/auth.ts with NextAuth config                   │
   │  • Added API routes for authentication                         │
   │  • Updated middleware for protected routes                     │
   │  • Added .env.example with required variables                  │
   │                                                                  │
   │  Next steps:                                                    │
   │  1. Add your Google OAuth credentials to .env                  │
   │  2. Run: npx prisma db push                                    │
   │  3. Test at /api/auth/signin                                   │
   │                                                                  │
   ╰─────────────────────────────────────────────────────────────────╯

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Modes & Skills

### Mode Indicator & Switching

The mode indicator is always visible and shows current mode + available actions:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  ┌─ Mode ──────────────────────────────────────────────────────────────┐    │
│  │                                                                      │    │
│  │   [ Auto ]   [ Explore ]   [ Execute ]   [ Plan ]   [ Review ]      │    │
│  │      ●                         ○                                     │    │
│  │                                                                      │    │
│  │   Current: Auto - I decide the best approach                        │    │
│  │   Press Tab to cycle, or click to switch                            │    │
│  │                                                                      │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Mode Details Panel (on hover or ?)

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                   │
│  Execute Mode                                                 X  │
│                                                                   │
│  Get it done - full tool access                                  │
│                                                                   │
│  ┌─ Capabilities ───────────────────────────────────────────┐   │
│  │  ✓ Read files              ✓ Search web                  │   │
│  │  ✓ Write files             ✓ Spawn agents                │   │
│  │  ✓ Run commands            ✓ Use MCP tools               │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─ Behavior ───────────────────────────────────────────────┐   │
│  │  • Makes changes confidently                              │   │
│  │  • Asks only when truly blocked                           │   │
│  │  • Reports progress clearly                               │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                   │
│  Keyboard: X or Tab to cycle                                     │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Skills Panel

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  Active Skills                                                   [ + Add ]  │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  ✍️ Writer           Auto-activated from "write blog post"      [x] │   │
│  │                                                                      │   │
│  │  🔍 Researcher       Auto-activated from "research"             [x] │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  Available Skills                                                            │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  💻 Coder            Code, debug, refactor                    [ + ] │   │
│  │  📊 Analyst          Data analysis, visualization             [ + ] │   │
│  │  📋 Planner          Roadmaps, specs, breakdown               [ + ] │   │
│  │  🎨 Designer         UI/UX, visual design                     [ + ] │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  Skills auto-activate based on your request. Manual activation              │
│  gives more control.                                                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Sub-Agent Experience

### Spawning a Sub-Agent

**Trigger 1: Jelico suggests it**

```
╭─────────────────────────────────────────────────────────────────╮
│                                                                  │
│  This is a complex task. I can either:                          │
│                                                                  │
│  1. Handle it myself (sequential, ~15 min)                      │
│  2. Spawn sub-agents for parallel work (~5 min)                 │
│     • Agent 1: Research competitors                             │
│     • Agent 2: Analyze our current metrics                      │
│     • Agent 3: Draft recommendations                            │
│                                                                  │
│  [ Do it yourself ]  [ Spawn agents (faster) ]                  │
│                                                                  │
╰─────────────────────────────────────────────────────────────────╯
```

**Trigger 2: User requests it**

```
User: "Spawn an agent to research AI safety while we work on something else"
```

**Trigger 3: Command palette**

```
⌘K → "spawn" → Configure agent
```

### Agent Spawn Dialog

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  🤖 Spawn Sub-Agent                                                     X   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  Name (optional)                                                     │   │
│  │  ┌───────────────────────────────────────────────────────────────┐  │   │
│  │  │ Research Assistant                                             │  │   │
│  │  └───────────────────────────────────────────────────────────────┘  │   │
│  │                                                                      │   │
│  │  Task                                                                │   │
│  │  ┌───────────────────────────────────────────────────────────────┐  │   │
│  │  │ Research the latest developments in AI safety, focusing on    │  │   │
│  │  │ constitutional AI, RLHF alternatives, and interpretability.   │  │   │
│  │  │ Create a summary with key papers and findings.                │  │   │
│  │  │                                                                │  │   │
│  │  └───────────────────────────────────────────────────────────────┘  │   │
│  │                                                                      │   │
│  │  Skills                                                              │   │
│  │  ┌───────────────────────────────────────────────────────────────┐  │   │
│  │  │  [🔍 Researcher ✓]  [✍️ Writer ✓]  [💻 Coder]  [📊 Analyst]   │  │   │
│  │  └───────────────────────────────────────────────────────────────┘  │   │
│  │                                                                      │   │
│  │  Options                                                             │   │
│  │  ┌───────────────────────────────────────────────────────────────┐  │   │
│  │  │  [✓] Run in background                                        │  │   │
│  │  │  [ ] Use separate worktree (for code changes)                 │  │   │
│  │  │  [ ] Require approval before actions                          │  │   │
│  │  └───────────────────────────────────────────────────────────────┘  │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│                                         [ Cancel ]      [ Spawn Agent ]     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Active Agents Panel (Sidebar)

```
┌─────────────────────┐
│                     │
│  🤖 Agents          │
│                     │
│  ┌───────────────┐  │
│  │ Research Asst │  │
│  │ ●● running    │  │
│  │ 45% · 2.3k tk │  │
│  │ ───────────── │  │
│  │ Searching for │  │
│  │ papers on...  │  │
│  └───────────────┘  │
│                     │
│  ┌───────────────┐  │
│  │ Code Reviewer │  │
│  │ ✓ completed   │  │
│  │ 100% · 5.1k   │  │
│  │ ───────────── │  │
│  │ Found 3 issues│  │
│  │ [View Report] │  │
│  └───────────────┘  │
│                     │
│  ┌───────────────┐  │
│  │ Data Analyst  │  │
│  │ ⏸ waiting     │  │
│  │ Needs input   │  │
│  │ [Respond]     │  │
│  └───────────────┘  │
│                     │
│  [ + Spawn Agent ]  │
│                     │
└─────────────────────┘
```

### Agent Detail View (Click to expand)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  🤖 Research Assistant                                          ● running   │
│                                                                              │
│  ┌─ Task ──────────────────────────────────────────────────────────────┐   │
│  │ Research the latest developments in AI safety, focusing on          │   │
│  │ constitutional AI, RLHF alternatives, and interpretability.         │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─ Progress ──────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  [████████████████████░░░░░░░░░░░░░░░░░░░░] 45%                     │   │
│  │                                                                      │   │
│  │  ✓ Searched academic databases                                      │   │
│  │  ✓ Found 12 relevant papers                                         │   │
│  │  ● Reading and summarizing papers (7/12)                            │   │
│  │  ○ Cross-referencing findings                                       │   │
│  │  ○ Creating summary report                                          │   │
│  │                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─ Stats ─────────────────────────────────────────────────────────────┐   │
│  │  Tokens: 2,341 input · 892 output                                   │   │
│  │  Tools: 8 calls (web_search: 5, fetch: 3)                          │   │
│  │  Runtime: 2m 34s                                                    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─ Live Activity ─────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  > Reading: "Constitutional AI: Harmlessness from AI Feedback"      │   │
│  │  > Extracting key findings...                                       │   │
│  │  > Note: Paper introduces RLAIF methodology                         │   │
│  │                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  [ Pause ]  [ Stop ]  [ View Full Log ]                                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Agent Completion Notification

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│  🤖 Research Assistant completed                            X   │
│                                                                  │
│  Created: AI Safety Research Summary                            │
│                                                                  │
│  Key findings:                                                   │
│  • Constitutional AI reduces harmful outputs by 40%             │
│  • New interpretability methods from Anthropic                  │
│  • 3 promising RLHF alternatives identified                     │
│                                                                  │
│  [ View Report ]  [ Dismiss ]                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Agent Report Merged to Chat

When an agent completes, its report is added to your conversation:

```
╭─────────────────────────────────────────────────────────────────╮
│  🤖 Research Assistant completed their task:                    │
│                                                                  │
│  ┌─ AI Safety Research Summary ────────────────────────────┐    │
│  │                                                          │    │
│  │  ## Key Developments                                     │    │
│  │                                                          │    │
│  │  ### Constitutional AI (Anthropic)                       │    │
│  │  - RLAIF approach reduces harmful outputs by 40%         │    │
│  │  - Paper: Constitutional AI: Harmlessness...             │    │
│  │                                                          │    │
│  │  ### Interpretability                                    │    │
│  │  - Sparse autoencoders showing promise                   │    │
│  │  - Paper: Scaling Monosemanticity...                     │    │
│  │  ...                                                     │    │
│  │                                                          │    │
│  │  [View full report →]                                    │    │
│  │                                                          │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  What would you like to do with these findings?                 │
│                                                                  │
╰─────────────────────────────────────────────────────────────────╯
```

---

## Worktree Workflow

### Creating a Worktree

**Trigger 1: From workspace header**

```
┌─ Workspace ────────────────────────────────────────────────────────┐
│  📁 my-project                                                      │
│  ┌─ main ─┐  ┌─ feature/auth ─┐  ┌─ + ─┐  ← Click to create       │
└─────────────────────────────────────────────────────────────────────┘
```

**Trigger 2: When spawning agent with code changes**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  This agent will modify code. Would you like to:                            │
│                                                                              │
│  ○ Work in current branch (main)                                            │
│     Changes mixed with your work                                            │
│                                                                              │
│  ● Create a worktree                                                         │
│     Agent works in isolated branch, merge when ready                        │
│     Branch name: agent/auth-implementation                                  │
│                                                                              │
│                                        [ Cancel ]  [ Continue ]             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Worktree Tabs

```
┌─ Workspace ────────────────────────────────────────────────────────────────┐
│                                                                             │
│  📁 my-project                                                              │
│                                                                             │
│  ┌──────────────┐  ┌──────────────────┐  ┌────────────────────┐  ┌─────┐  │
│  │   main       │  │  feature/auth    │  │  agent/research    │  │  +  │  │
│  │   (you)      │  │  (you)           │  │  🤖 running        │  │     │  │
│  │   ●          │  │                  │  │  ●●                │  │     │  │
│  └──────────────┘  └──────────────────┘  └────────────────────┘  └─────┘  │
│       ▲ active                                                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Worktree Context Menu

```
Right-click on worktree tab:

┌────────────────────────────────┐
│  Switch to this worktree       │
│  ───────────────────────────── │
│  View changes (diff)           │
│  View agent progress           │
│  ───────────────────────────── │
│  Merge to main                 │
│  Merge to main (squash)        │
│  ───────────────────────────── │
│  Delete worktree               │
└────────────────────────────────┘
```

### Merging a Worktree

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  Merge Worktree                                                         X   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                                                                       │   │
│  │  agent/auth-implementation → main                                     │   │
│  │                                                                       │   │
│  │  ┌─ Changes ────────────────────────────────────────────────────┐    │   │
│  │  │  + lib/auth.ts                    (new file)                 │    │   │
│  │  │  + app/api/auth/[...nextauth]/route.ts  (new file)          │    │   │
│  │  │  ~ middleware.ts                  (+15 -2 lines)             │    │   │
│  │  │  ~ .env.example                   (+5 lines)                 │    │   │
│  │  └──────────────────────────────────────────────────────────────┘    │   │
│  │                                                                       │   │
│  │  ┌─ Options ────────────────────────────────────────────────────┐    │   │
│  │  │  [✓] Squash commits (recommended)                            │    │   │
│  │  │  [✓] Delete worktree after merge                             │    │   │
│  │  │  [ ] Create pull request instead                             │    │   │
│  │  └──────────────────────────────────────────────────────────────┘    │   │
│  │                                                                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│                                           [ Cancel ]  [ Merge ]             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## MCP Configuration

### MCP Overview Screen

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  ← Settings                         MCP Servers                              │
│                                                                              │
│  Model Context Protocol (MCP) extends Jelico with external tools.           │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  Built-in Servers                                                    │   │
│  │                                                                      │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │  ✓  Filesystem                                    ● running │   │   │
│  │  │      Read and write files in your workspace                 │   │   │
│  │  │      Tools: read_file, write_file, list_directory           │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │  ✓  Git                                           ● running │   │   │
│  │  │      Git operations and history                             │   │   │
│  │  │      Tools: git_status, git_diff, git_log, git_commit       │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │  ✓  Web Fetch                                     ● running │   │   │
│  │  │      Fetch and parse web pages                              │   │   │
│  │  │      Tools: fetch_url, extract_content                      │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │  ○  Web Search                                    ○ stopped │   │   │
│  │  │      Search the web with Brave                              │   │   │
│  │  │      Requires: BRAVE_API_KEY                    [Configure] │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  Custom Servers                                         [ + Add ]   │   │
│  │                                                                      │   │
│  │  No custom servers configured                                       │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Adding Custom MCP Server

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  Add MCP Server                                                         X   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  Name                                                                │   │
│  │  ┌───────────────────────────────────────────────────────────────┐  │   │
│  │  │ Notion                                                         │  │   │
│  │  └───────────────────────────────────────────────────────────────┘  │   │
│  │                                                                      │   │
│  │  Description                                                         │   │
│  │  ┌───────────────────────────────────────────────────────────────┐  │   │
│  │  │ Access Notion pages and databases                              │  │   │
│  │  └───────────────────────────────────────────────────────────────┘  │   │
│  │                                                                      │   │
│  │  Command                                                             │   │
│  │  ┌───────────────────────────────────────────────────────────────┐  │   │
│  │  │ npx                                                            │  │   │
│  │  └───────────────────────────────────────────────────────────────┘  │   │
│  │                                                                      │   │
│  │  Arguments                                                           │   │
│  │  ┌───────────────────────────────────────────────────────────────┐  │   │
│  │  │ -y @anthropic/mcp-server-notion                               │  │   │
│  │  └───────────────────────────────────────────────────────────────┘  │   │
│  │                                                                      │   │
│  │  Environment Variables                                   [ + Add ]  │   │
│  │  ┌───────────────────────────────────────────────────────────────┐  │   │
│  │  │  NOTION_TOKEN    │  secret_abc123...               │   [x]   │  │   │
│  │  └───────────────────────────────────────────────────────────────┘  │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│                                           [ Cancel ]  [ Add Server ]        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### MCP Server Detail

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  ← Back                             Filesystem Server                        │
│                                                                              │
│  Status: ● Running                                                          │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  Available Tools                                                     │   │
│  │                                                                      │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │  read_file                                                   │   │   │
│  │  │  Read the contents of a file                                │   │   │
│  │  │  Parameters: path (string, required)                        │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │  write_file                                                  │   │   │
│  │  │  Write content to a file                                    │   │   │
│  │  │  Parameters: path (string), content (string)                │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │  list_directory                                              │   │   │
│  │  │  List files and directories                                 │   │   │
│  │  │  Parameters: path (string), recursive (boolean)             │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  Configuration                                                       │   │
│  │                                                                      │   │
│  │  Command: npx -y @modelcontextprotocol/server-filesystem            │   │
│  │  Arguments: .                                                        │   │
│  │  Working Directory: (current workspace)                             │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  [ Restart ]  [ Stop ]  [ Edit ]  [ Remove ]                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### MCP in Action (Chat)

When Jelico uses MCP tools, it's shown inline:

```
╭─────────────────────────────────────────────────────────────────╮
│                                                                  │
│  Let me check your project structure...                         │
│                                                                  │
│  ┌─ Tool: filesystem.list_directory ──────────────────────────┐ │
│  │  path: "."                                                  │ │
│  │  ────────────────────────────────────────────────────────── │ │
│  │  ✓ Found 12 items                                           │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─ Tool: filesystem.read_file ───────────────────────────────┐ │
│  │  path: "package.json"                                       │ │
│  │  ────────────────────────────────────────────────────────── │ │
│  │  ✓ Read 1.2KB                                               │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  I see this is a Next.js 14 project with TypeScript...          │
│                                                                  │
╰─────────────────────────────────────────────────────────────────╯
```

---

## Artifacts & Canvas

### Artifact Detection & Display

When Jelico generates code or content, artifacts appear automatically:

```
┌─────────────────────────────────────┐  ┌────────────────────────────────────┐
│                                     │  │                                    │
│  Chat Panel                         │  │  Artifacts Panel                   │
│                                     │  │                                    │
│  ╭───────────────────────────────╮  │  │  ┌─ Files ───────────────────────┐│
│  │ You: Create a React dashboard │  │  │  │ Dashboard.tsx  │ styles.css  ││
│  ╰───────────────────────────────╯  │  │  └──────────────────────────────┘│
│                                     │  │                                    │
│  ╭───────────────────────────────╮  │  │  ┌─ View ────────────────────────┐│
│  │ Creating a dashboard...       │  │  │  │ [Code] [Split] [Preview]     ││
│  │                               │  │  │  └──────────────────────────────┘│
│  │ ```tsx                        │  │  │                                    │
│  │ (collapsed - see canvas →)    │  │  │  ┌──────────────────────────────┐│
│  │ ```                           │  │  │  │ import { Card } from './ui'  ││
│  │                               │  │  │  │                              ││
│  │ This dashboard includes:      │  │  │  │ export default function      ││
│  │ • Stats cards                 │  │  │  │ Dashboard() {                ││
│  │ • Chart component             │  │  │  │   return (                   ││
│  │ • Recent activity             │  │  │  │     <div className="grid..   ││
│  │                               │  │  │  │       <Card title="Users">   ││
│  ╰───────────────────────────────╯  │  │  │         ...                  ││
│                                     │  │  └──────────────────────────────┘│
│                                     │  │                                    │
└─────────────────────────────────────┘  └────────────────────────────────────┘
```

### Code Canvas Features

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  ┌─ Toolbar ───────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  Dashboard.tsx                           v2 ▼  [Diff]  [Copy] [⤓]  │   │
│  │                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─ Editor (Monaco) ───────────────────────────────────────────────────┐   │
│  │  1  │ import { Card, Chart } from './components/ui';                │   │
│  │  2  │ import { useData } from './hooks/useData';                    │   │
│  │  3  │                                                                │   │
│  │  4  │ export default function Dashboard() {                         │   │
│  │  5  │   const { stats, chartData, activities } = useData();         │   │
│  │  6  │                                                                │   │
│  │  7  │   return (                                                     │   │
│  │  8  │     <div className="grid grid-cols-3 gap-4 p-6">              │   │
│  │  9  │       {/* Stats Cards */}                                      │   │
│  │ 10  │       <Card title="Total Users" value={stats.users} />        │   │
│  │ 11  │       <Card title="Revenue" value={stats.revenue} />          │   │
│  │ 12  │       <Card title="Active" value={stats.active} />            │   │
│  │ 13  │                                                                │   │
│  │ 14  │       {/* Chart */}                                            │   │
│  │ 15  │       <div className="col-span-2">                             │   │
│  │ 16  │         <Chart data={chartData} type="line" />                │   │
│  │ ...                                                                  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─ Version History ───────────────────────────────────────────────────┐   │
│  │  v1 (initial) → v2 (current) +chart                                 │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Diff View

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  ┌─ Diff: v1 → v2 ─────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │    7  │   return (                                                   │   │
│  │    8  │     <div className="grid grid-cols-3 gap-4 p-6">            │   │
│  │       │                                                              │   │
│  │  - 9  │       <Card title="Users" value={100} />                    │   │
│  │  + 9  │       {/* Stats Cards */}                                   │   │
│  │  +10  │       <Card title="Total Users" value={stats.users} />      │   │
│  │  +11  │       <Card title="Revenue" value={stats.revenue} />        │   │
│  │  +12  │       <Card title="Active" value={stats.active} />          │   │
│  │       │                                                              │   │
│  │  +14  │       {/* Chart */}                                         │   │
│  │  +15  │       <div className="col-span-2">                          │   │
│  │  +16  │         <Chart data={chartData} type="line" />              │   │
│  │  +17  │       </div>                                                │   │
│  │       │                                                              │   │
│  │                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  +12 lines added  -1 line removed                                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Live Preview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  ┌─ Preview ───────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  [ Refresh ]  [ Open in Browser ]  [ 📱 💻 🖥️ ]                     │   │
│  │                                                                      │   │
│  │  ┌──────────────────────────────────────────────────────────────┐  │   │
│  │  │                                                               │  │   │
│  │  │   ┌─────────┐  ┌─────────┐  ┌─────────┐                      │  │   │
│  │  │   │ Users   │  │ Revenue │  │ Active  │                      │  │   │
│  │  │   │  1,234  │  │ $45.2K  │  │   89%   │                      │  │   │
│  │  │   └─────────┘  └─────────┘  └─────────┘                      │  │   │
│  │  │                                                               │  │   │
│  │  │   ┌───────────────────────────────────────────────────────┐  │  │   │
│  │  │   │                      📈                                │  │  │   │
│  │  │   │                   ╱╲    ╲                              │  │  │   │
│  │  │   │                 ╱    ╲    ╲                            │  │  │   │
│  │  │   │    ╱──╲      ╱        ╲    ╲                          │  │  │   │
│  │  │   │  ╱      ╲──╱            ╲──╱                           │  │  │   │
│  │  │   │ ╱                                                      │  │  │   │
│  │  │   │ Jan  Feb  Mar  Apr  May  Jun                           │  │  │   │
│  │  │   └───────────────────────────────────────────────────────┘  │  │   │
│  │  │                                                               │  │   │
│  │  └──────────────────────────────────────────────────────────────┘  │   │
│  │                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Settings & Preferences

### Settings Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  Settings                                                                    │
│                                                                              │
│  ┌──────────────────┐  ┌───────────────────────────────────────────────────┐│
│  │                  │  │                                                    ││
│  │  General         │  │  General Settings                                  ││
│  │  Providers       │  │                                                    ││
│  │  MCP Servers     │  │  ┌─ Appearance ──────────────────────────────┐    ││
│  │  Keyboard        │  │  │                                           │    ││
│  │  Privacy         │  │  │  Theme           [ System ▼ ]             │    ││
│  │  About           │  │  │  Font Size       [ Medium ▼ ]             │    ││
│  │                  │  │  │  Code Font       [ JetBrains Mono ▼ ]     │    ││
│  │                  │  │  │                                           │    ││
│  │                  │  │  └───────────────────────────────────────────┘    ││
│  │                  │  │                                                    ││
│  │                  │  │  ┌─ Behavior ────────────────────────────────┐    ││
│  │                  │  │  │                                           │    ││
│  │                  │  │  │  Default Mode    [ Auto ▼ ]               │    ││
│  │                  │  │  │  Auto-save       [✓] Enabled              │    ││
│  │                  │  │  │  Notifications   [✓] Enabled              │    ││
│  │                  │  │  │                                           │    ││
│  │                  │  │  └───────────────────────────────────────────┘    ││
│  │                  │  │                                                    ││
│  │                  │  │  ┌─ Privacy ─────────────────────────────────┐    ││
│  │                  │  │  │                                           │    ││
│  │                  │  │  │  Send diagnostics  [ ] Disabled           │    ││
│  │                  │  │  │  Local history     [✓] Keep 30 days       │    ││
│  │                  │  │  │                                           │    ││
│  │                  │  │  └───────────────────────────────────────────┘    ││
│  │                  │  │                                                    ││
│  └──────────────────┘  └───────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Keyboard Shortcuts

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  ← Settings                    Keyboard Shortcuts                            │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  Navigation                                                          │   │
│  │  ─────────────────────────────────────────────────────────────────  │   │
│  │  Command palette               ⌘ K                                  │   │
│  │  New chat                      ⌘ N                                  │   │
│  │  Open workspace                ⌘ O                                  │   │
│  │  Toggle sidebar                ⌘ B                                  │   │
│  │  Settings                      ⌘ ,                                  │   │
│  │                                                                      │   │
│  │  Modes                                                               │   │
│  │  ─────────────────────────────────────────────────────────────────  │   │
│  │  Cycle mode forward            Tab                                  │   │
│  │  Cycle mode backward           Shift Tab                            │   │
│  │  Auto mode                     ⌘ 1                                  │   │
│  │  Explore mode                  ⌘ 2                                  │   │
│  │  Execute mode                  ⌘ 3                                  │   │
│  │  Plan mode                     ⌘ 4                                  │   │
│  │  Review mode                   ⌘ 5                                  │   │
│  │                                                                      │   │
│  │  Chat                                                                │   │
│  │  ─────────────────────────────────────────────────────────────────  │   │
│  │  Send message                  Enter                                │   │
│  │  New line                      Shift Enter                          │   │
│  │  Cancel / Stop                 Escape                               │   │
│  │  Regenerate last               ⌘ R                                  │   │
│  │                                                                      │   │
│  │  Agents                                                              │   │
│  │  ─────────────────────────────────────────────────────────────────  │   │
│  │  Spawn agent                   ⌘ Shift A                            │   │
│  │  View agents                   ⌘ Shift G                            │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  [ Reset to Defaults ]                                                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Interaction Principles Summary

### 1. Progressive Disclosure

```
Simple request → Simple response
Complex request → Show options/plan first
Ambiguous request → Clarify efficiently
```

### 2. Minimal Interruptions

```
❌ "Are you sure you want to do X?"
✓ Just do X, show undo option

❌ "I'll need to search the web. Is that okay?"
✓ Just search, show what you're doing

❌ "Would you like me to explain more?"
✓ Give complete answer, let them ask if needed
```

### 3. Show Don't Tell

```
❌ "I'm going to read the file now..."
✓ [Tool: read_file → ✓]

❌ "Here's what I found after searching..."
✓ [Search results inline] → [Analysis]
```

### 4. Keyboard First

Every action has a keyboard shortcut. Power users never need the mouse.

### 5. Context Persistence

Jelico remembers:
- Your preferred mode per project
- Active skills per workspace
- Recent models used
- Window layout

### 6. Graceful Degradation

No provider? → Still browse files, make plans
No MCP? → Still chat, still useful
Offline? → Review past conversations, local models

---

## Visual Design Tokens

```css
/* Colors */
--bg-primary: #0a0a0b;      /* Main background */
--bg-secondary: #111113;     /* Panels */
--bg-tertiary: #1a1a1d;      /* Cards, inputs */
--bg-hover: #252528;         /* Hover states */

--text-primary: #ffffff;     /* Main text */
--text-secondary: #a1a1aa;   /* Secondary text */
--text-muted: #52525b;       /* Muted text */

--accent-blue: #3b82f6;      /* Primary actions */
--accent-green: #22c55e;     /* Success, running */
--accent-yellow: #eab308;    /* Warning, pending */
--accent-red: #ef4444;       /* Error, destructive */

--border: #27272a;           /* Borders */

/* Typography */
--font-sans: 'Inter', system-ui;
--font-mono: 'JetBrains Mono', monospace;

/* Spacing */
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-6: 24px;
--space-8: 32px;

/* Radius */
--radius-sm: 4px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-xl: 16px;
```

---

This UX guide provides the blueprint for building Jelico's interface. The key is **frictionless flow** - every interaction should feel instant, predictable, and empowering.
