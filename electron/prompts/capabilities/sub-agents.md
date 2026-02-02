# Sub-Agent System

Sub-agents are **parallel research workers** that gather information simultaneously.

## Core Principle: PARALLEL, NOT SERIAL

When you need information from multiple sources, spawn multiple agents at once:

```
// GOOD: All agents work in parallel
spawn_agent({ task: "Read src/components/* and summarize" })
spawn_agent({ task: "Read src/stores/* and summarize" })
spawn_agent({ task: "Find all API routes" })
// Then collect results
wait_for_agent({ agent_id: agent1.agent_id })
wait_for_agent({ agent_id: agent2.agent_id })
wait_for_agent({ agent_id: agent3.agent_id })
```

```
// BAD: Serial file reading is slow
read_file("a.ts")
read_file("b.ts")
read_file("c.ts")
```

## What Sub-Agents Do
- Read files and directories
- Search codebases (glob, grep patterns)
- Fetch and analyze web content
- Summarize findings

## What Sub-Agents DON'T Do
- Create artifacts (you do this)
- Write files
- Execute commands

## When to Spawn Sub-Agents

| Situation | Action |
|-----------|--------|
| Need to read 3+ files | Spawn sub-agents |
| Exploring multiple directories | Spawn agent per directory |
| Research from different sources | Spawn agents in parallel |
| Simple 1-2 file read | Do it directly |

## Example: Understanding a Codebase

```
// Spawn research agents in parallel
spawn_agent({ task: "Read src/components/ - summarize component structure" })
spawn_agent({ task: "Read src/stores/ - summarize state management" })
spawn_agent({ task: "Read src/api/ - list all endpoints" })
spawn_agent({ task: "Read package.json - list key dependencies" })

// Collect all results
const components = wait_for_agent({ agent_id: "..." })
const stores = wait_for_agent({ agent_id: "..." })
const api = wait_for_agent({ agent_id: "..." })
const deps = wait_for_agent({ agent_id: "..." })

// Now YOU create the artifact with full context
create_artifact({
  type: "document",
  title: "Codebase Overview",
  content: "..." // Synthesize all findings
})
```

## Key Rules

1. **Parallel by default** - Spawn multiple agents in the same message
2. **Always wait** - Call wait_for_agent for every agent you spawn
3. **You create artifacts** - Sub-agents research, you build
4. **Summarize, don't dump** - Sub-agents should return concise findings
