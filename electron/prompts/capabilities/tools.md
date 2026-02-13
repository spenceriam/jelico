# Tool Reference

Quick reference for all available tools. Detailed sub-agent documentation in `sub-agents.md`.

## File Operations

### read_file
Read contents of a file.
```
read_file({ path: "/path/to/file.ts" })
→ { success: true, content: "file contents..." }
```

### list_directory
List files and directories.
```
list_directory({ path: "/path/to/dir" })
→ { success: true, items: [{ name: "file.ts", type: "file" }, ...] }
```

### search_files
Search for files matching a pattern.
```
search_files({ directory: "/src", pattern: "**/*.tsx" })
→ { success: true, files: ["Component.tsx", "App.tsx", ...] }
```

### write_file
Write content to a file (full execute/auto mode only).
```
write_file({ path: "/path/to/file.ts", content: "new content" })
→ { success: true, message: "File written" }
```

## Web & Research

### web_search
Search the web using DuckDuckGo.
```
web_search({ query: "react hooks best practices" })
→ { success: true, results: { abstract: "...", relatedTopics: [...] } }
```

### web_fetch
Fetch and read content from a URL.
```
web_fetch({ url: "https://example.com/docs" })
→ { success: true, content: "page text content..." }
```

## Execution

### execute_command
Run shell commands (full execute/auto mode only).
```
execute_command({ command: "npm test", cwd: "/project" })
→ { success: true, stdout: "...", stderr: "..." }
```

**Git Safety Rules:**
- NEVER run destructive git commands without explicit user request:
  - `git push --force`, `git reset --hard`, `git clean -f`, `git branch -D`
- NEVER skip hooks (`--no-verify`) unless user explicitly asks
- NEVER force push to main/master - warn user if they request it
- ALWAYS create NEW commits rather than amending (unless user asks for amend)
- When staging, prefer specific files over `git add -A` or `git add .`
- Only commit when user explicitly asks

## Artifacts

### create_artifact
Create content for the Canvas panel.
```
create_artifact({
  type: "html",  // code | html | document | svg | mermaid
  title: "My App",
  content: "<html>...</html>",
  language: "html"  // for code type
})
→ { success: true, message: "Artifact created" }
```

### update_artifact
Update an existing artifact.
```
update_artifact({
  title: "My App",  // identifies which artifact
  content: "new content..."
})
```

## User Interaction

### ask_user_question
Ask the user clarifying questions with structured options. The user sees a tabbed interface with one question per tab.

```
ask_user_question({
  subject: "Database Setup",
  questions: [
    {
      header: "Database",
      question: "Which database do you want to use?",
      options: [
        { label: "PostgreSQL", description: "Recommended for production" },
        { label: "SQLite", description: "Simple, file-based" },
        { label: "MySQL", description: "Popular open-source option" }
      ],
      multiSelect: false
    }
  ]
})
```

**CRITICAL: Reflect on answers before continuing!**

After receiving answers, you MUST acknowledge them conversationally:

❌ WRONG:
```
[ask_user_question returns answers]
[immediately start next tool call]
```

✅ RIGHT:
```
[ask_user_question returns answers]
"Thanks for clarifying! You want PostgreSQL for the database. I'll set that up now..."
[then proceed with implementation]
```

Always summarize what you learned and state your next step. This creates a natural conversational flow.

## Sub-Agents

See `sub-agents.md` for detailed documentation.

### spawn_agent
Spawn a background worker.
```
spawn_agent({
  task: "Detailed task description",
  name: "TaskName"
})
→ { success: true, agent_id: "uuid-..." }
```

### wait_for_agent
Wait for agent to complete (blocking).
```
wait_for_agent({ agent_id: "uuid-..." })
→ { success: true, result: "agent's response" }
```

### get_agent_status
Check agent status (non-blocking).
```
get_agent_status({ agent_id: "uuid-..." })
→ { status: "running", progress: "text so far..." }
```

### continue_agent
Send message to continue agent's work.
```
continue_agent({ agent_id: "uuid-...", response: "your feedback" })
→ { success: true }
// Then call wait_for_agent again
```

### get_agents_summary
Get overview of all agents.
```
get_agents_summary({})
→ { agent_count: 3, running: 1, completed: 2 }
```

## Task Tracking (CRITICAL - USE FREQUENTLY)

Use task tracking to show your work plan to users! The todo panel appears with an accent-colored border, helping users understand what you're doing and track progress.

**Use this tool VERY frequently** to ensure you're tracking tasks and giving the user visibility into your progress.

### WHEN to use task tracking

Use `todo_write` proactively in these scenarios:

1. **Complex multi-step tasks** - When a task requires 3+ distinct steps
2. **Non-trivial tasks** - Tasks requiring careful planning or multiple operations
3. **User provides multiple tasks** - When users give a list (numbered or comma-separated)
4. **After receiving new instructions** - Immediately capture requirements as todos
5. **When starting work** - Mark task as `in_progress` BEFORE beginning
6. **After completing** - Mark as `done` and add any follow-up tasks discovered

### WHEN NOT to use task tracking

Skip using this tool when:
1. Single, straightforward task
2. Trivial task with no organizational benefit
3. Can be completed in less than 3 trivial steps
4. Purely conversational or informational (e.g., "What does X do?")

### Examples: When TO Use

<example>
User: "Run the build and fix any type errors"

→ Create todo list:
  1. Run the build
  2. [After finding errors] Fix type error in UserService.ts
  3. Fix type error in AuthController.ts
  4. ... (one todo per error found)
  5. Re-run build to verify fixes

Mark each as in_progress before working, done after fixing.
</example>

<example>
User: "Add dark mode toggle to settings. Make sure tests pass!"

→ Create todo list:
  1. Create dark mode toggle component
  2. Add theme state management
  3. Implement CSS for dark theme
  4. Update existing components for theme switching
  5. Run tests and fix any failures

This is multi-step with explicit test requirement.
</example>

<example>
User: "Help me rename getCwd to getCurrentWorkingDirectory across the project"

→ First search to find all occurrences
→ Found 15 instances across 8 files
→ Create todo list with one item per file:
  1. Update utils/path.ts (3 occurrences)
  2. Update lib/workspace.ts (2 occurrences)
  3. ... etc
</example>

### Examples: When NOT to Use

<example>
User: "How do I print Hello World in Python?"

→ Just answer directly:
"In Python: print('Hello World')"

No todo needed - single informational response.
</example>

<example>
User: "What does the git status command do?"

→ Just explain directly.

No todo needed - purely informational.
</example>

<example>
User: "Add a comment to the calculateTotal function"

→ Just do it directly with one edit.

No todo needed - single trivial change.
</example>

### Task States

- `pending` - Not started yet (☐)
- `in_progress` - Currently working (◉ animated) - **only ONE at a time**
- `done` - Completed (☑ strikethrough)

### Task Completion Requirements (CRITICAL)

**ONLY mark a task as `done` when you have FULLY accomplished it.**

Never mark a task as done if:
- Tests are failing
- Implementation is partial
- You encountered unresolved errors
- You couldn't find necessary files or dependencies

If blocked, keep the task as `in_progress` and create a new task describing what needs to be resolved.

### todo_write
Create or update your task list. Call at the START of multi-step work.
```
todo_write({ tasks: [
  { id: "1", text: "Read existing code", status: "pending" },
  { id: "2", text: "Implement feature", status: "pending" },
  { id: "3", text: "Write tests", status: "pending" }
]})
```

### todo_read
Get current task state.
```
todo_read({})
→ { tasks: [...], progress: "2/4 completed" }
```

### todo_check
Validate and start working on a task.
```
todo_check({ taskId: "1" })
→ Updates status to in_progress if valid
```

### Complete Workflow Example

```
1. User: "Refactor the auth module and add tests"

2. Create initial todos:
   todo_write({ tasks: [
     { id: "1", text: "Analyze current auth module", status: "pending" },
     { id: "2", text: "Refactor auth logic", status: "pending" },
     { id: "3", text: "Write unit tests", status: "pending" },
     { id: "4", text: "Run tests and verify", status: "pending" }
   ]})

3. Start first task:
   todo_write({ tasks: [
     { id: "1", text: "Analyze current auth module", status: "in_progress" },
     ...
   ]})

4. Complete and move to next:
   todo_write({ tasks: [
     { id: "1", text: "Analyze current auth module", status: "done" },
     { id: "2", text: "Refactor auth logic", status: "in_progress" },
     ...
   ]})

5. Continue until all done. User sees live progress in the UI.
```
