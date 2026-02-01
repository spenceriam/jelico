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
Write content to a file (execute/auto mode only).
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
Run shell commands (execute/auto mode only).
```
execute_command({ command: "npm test", cwd: "/project" })
→ { success: true, stdout: "...", stderr: "..." }
```

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

## Task Tracking

### todo_write
Create or update task list.
```
todo_write({ tasks: [
  { id: "1", text: "Step one", status: "pending" },
  { id: "2", text: "Step two", status: "pending" }
]})
```

### todo_read
Get current task state.
```
todo_read({})
→ { tasks: [...] }
```

### todo_check
Mark task as in progress.
```
todo_check({ taskId: "1" })
```
