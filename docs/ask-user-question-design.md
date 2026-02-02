# AskUserQuestion UI/UX Design

## Overview

When the AI needs clarification before proceeding with a task, it calls `ask_user_question` which displays a structured multiple-choice interface to the user.

**Title format**: "Clarification required for: {subject}"

---

## Design Decision 1: Placement

### Option A: Inline in Chat (Recommended)
Appears as a special message type in the chat flow, after the AI's text.

```
┌─────────────────────────────────────────────────────────────┐
│ [J] I'll implement the caching system. Before I proceed,   │
│     I need to clarify a few things.                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ ┌─────────────────────────────────────────────────────────┐ │
│ │  ❓ Clarification required for: Implementing caching    │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │                                                         │ │
│ │  Which caching strategy should I use?                   │ │
│ │                                                         │ │
│ │   ○ Redis (Recommended)                                 │ │
│ │     Distributed, persistent, production-ready           │ │
│ │                                                         │ │
│ │   ○ In-memory                                           │ │
│ │     Simple, fast, but clears on restart                 │ │
│ │                                                         │ │
│ │   ○ File-based                                          │ │
│ │     Persistent locally, easy to debug                   │ │
│ │                                                         │ │
│ │   ○ Other...                                            │ │
│ │     ┌───────────────────────────────────────────────┐   │ │
│ │     │ Type your alternative...                      │   │ │
│ │     └───────────────────────────────────────────────┘   │ │
│ │                                                         │ │
│ │                              [Submit Answer]            │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

[ ChatInput - unchanged, but disabled while question pending ]
```

**Pros:**
- Feels natural in conversation flow
- Context visible (AI's reasoning above)
- Doesn't block the whole screen
- Scrollable if multiple questions

**Cons:**
- Might scroll out of view on long chats

---

### Option B: Modal Overlay
Similar to PermissionDialog, centered over everything.

```
                    ┌───────────────────────────────────────┐
                    │ ❓ Clarification required for:        │
                    │    Implementing caching               │
                    ├───────────────────────────────────────┤
                    │                                       │
                    │ Which caching strategy should I use?  │
                    │                                       │
                    │  ○ Redis (Recommended)                │
                    │    Distributed, persistent...         │
                    │                                       │
                    │  ○ In-memory                          │
                    │    Simple, fast...                    │
                    │                                       │
                    │  ○ Other...                           │
                    │    ┌─────────────────────────────┐    │
                    │    │                             │    │
                    │    └─────────────────────────────┘    │
                    │                                       │
                    │                    [Submit Answer]    │
                    └───────────────────────────────────────┘
```

**Pros:**
- Can't miss it
- Consistent with PermissionDialog
- Always visible

**Cons:**
- Blocks view of conversation context
- Feels more interruptive
- Loses AI's reasoning context

---

### Option C: Panel Above Chat Input
Slides in above the input area (where TodoPanel is).

```
┌─────────────────────────────────────────────────────────────┐
│                        [Chat messages]                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ❓ Clarification required for: Implementing caching     │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │  Which caching strategy?                                │ │
│ │   ○ Redis (Recommended)  ○ In-memory  ○ File-based     │ │
│ │   ○ Other: [____________]                               │ │
│ │                                      [Submit]           │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [Mode Selector]                                             │
│ [TodoPanel if active]                                       │
│ [ChatInput - disabled]                                      │
└─────────────────────────────────────────────────────────────┘
```

**Pros:**
- Doesn't block messages
- Near the input area (action zone)
- Compact

**Cons:**
- Limited space for long options/descriptions
- Might feel cramped with TodoPanel
- Horizontal layout less readable for many options

---

## Design Decision 2: Selection Interaction

### Option A: Click Option → Submit Button (Recommended)
User clicks to select, then confirms with Submit button.

```
   ○ Redis (Recommended)        ← Not selected
   ● In-memory                  ← Selected (filled circle)
   ○ File-based
   ○ Other...

                    [Submit Answer]  ← Enabled after selection
```

**Pros:**
- User can change mind before committing
- Clear two-step action (select → confirm)
- Consistent with forms

---

### Option B: Click Option → Auto-Submit
Clicking an option immediately submits.

**Pros:**
- One less click

**Cons:**
- No ability to reconsider
- Accidental clicks submit
- "Other" would need special handling

---

## Design Decision 3: "Other" Text Field

### Option A: Inline Expansion (Recommended)
Selecting "Other" expands a text field inline.

```
Before clicking "Other":
   ○ Redis (Recommended)
   ○ In-memory
   ○ File-based
   ○ Other...

After clicking "Other":
   ○ Redis (Recommended)
   ○ In-memory
   ○ File-based
   ● Other...
     ┌─────────────────────────────────────────────────┐
     │ I want to use Memcached instead                 │
     └─────────────────────────────────────────────────┘

                                        [Submit Answer]
```

**Pros:**
- Clean initial state
- Natural flow
- Text field appears where needed

---

### Option B: Always Visible Text Field
Text field always shown but disabled until "Other" selected.

**Cons:**
- Cluttered interface
- Confusing if not selecting "Other"

---

## Design Decision 4: Multi-Select Support

When `multiSelect: true`, use checkboxes instead of radio buttons.

```
Which features do you want to enable? (Select all that apply)

   ☑ Authentication
     User login/logout, sessions

   ☐ Rate limiting
     Prevent API abuse

   ☑ Logging
     Request/response logging

   ☐ Other...

                                        [Submit Answer]
```

---

## Visual Styling

Following Jelico's design language:

```css
/* Container - like TodoPanel with accent border */
.clarification-panel {
  border: 2px solid var(--accent);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  box-shadow: 0 0 20px var(--accent-glow);
}

/* Header */
.clarification-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--accent-dim);
  background: linear-gradient(135deg, var(--accent-glow) 0%, transparent 100%);
  color: var(--accent-bright);
  font-weight: 600;
}

/* Options */
.clarification-option {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  transition: background 0.15s;
}

.clarification-option:hover {
  background: var(--bg-hover);
}

.clarification-option.selected {
  background: var(--accent-glow);
  border-left: 3px solid var(--accent);
}

/* Submit button */
.clarification-submit {
  background: var(--accent);
  color: var(--text-on-accent);
  padding: 8px 16px;
  border-radius: var(--radius-sm);
}

.clarification-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

---

## Recommended Implementation

Based on the analysis:

1. **Placement**: Option A - Inline in Chat
2. **Interaction**: Option A - Click to select, Submit button to confirm
3. **Other field**: Option A - Inline expansion when "Other" clicked
4. **Styling**: Match TodoPanel's accent-border treatment

---

## Component Structure

```
src/components/Clarification/
├── ClarificationPanel.tsx      # Main panel component
├── ClarificationOption.tsx     # Single option row
└── ClarificationOtherField.tsx # Text input for "Other"

src/stores/clarification.ts     # State management
```

---

## Tool Definition

```typescript
tools.ask_user_question = tool({
  description: `Ask the user for clarification before proceeding.
Use when you need to make a decision that depends on user preference.`,
  parameters: z.object({
    subject: z.string().describe('Brief description of the task requiring clarification'),
    questions: z.array(z.object({
      question: z.string().describe('The question to ask'),
      options: z.array(z.object({
        label: z.string().describe('Option label (add "(Recommended)" suffix if preferred)'),
        description: z.string().optional().describe('Additional context for this option'),
      })).min(2).max(5),
      multiSelect: z.boolean().optional().describe('Allow multiple selections'),
    })).min(1).max(3),
  }),
  execute: async ({ subject, questions }) => {
    // Send to UI, wait for response
    const answers = await waitForUserClarification(subject, questions)
    return { success: true, answers }
  },
})
```
