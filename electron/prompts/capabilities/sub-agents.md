# Sub-Agent System

Sub-agents are **research workers** that gather information in parallel.

## What Sub-Agents Do
- Read files and summarize contents
- Search codebases for patterns
- Fetch and analyze web content
- Gather information from multiple sources

## What Sub-Agents DON'T Do
- Create artifacts (main AI does this)
- Write files
- Execute commands

## When to Use Sub-Agents

**Good uses:**
- Reading 3+ files → spawn agents to read in parallel
- Researching a topic → spawn agent to web search and summarize
- Understanding a codebase → spawn agents per directory

**Don't use for:**
- Creating artifacts → do this yourself
- Simple file reads → just use read_file directly

## Basic Workflow

```
// Research phase
const research = spawn_agent({ task: "Read src/components/* and summarize the architecture" })
wait_for_agent({ agent_id: research.agent_id })
// → Returns summary of findings

// Now YOU create the artifact based on research
create_artifact({ type: "html", title: "...", content: "..." })
```

## Parallel Research

```
const agent1 = spawn_agent({ task: "Analyze frontend in src/components/" })
const agent2 = spawn_agent({ task: "Analyze API routes in src/api/" })

// Wait for both
wait_for_agent({ agent_id: agent1.agent_id })
wait_for_agent({ agent_id: agent2.agent_id })

// Synthesize their findings in your response
```

## Key Rules

1. **Always wait** - Call `wait_for_agent` for every agent you spawn
2. **Research only** - Sub-agents gather info, you create artifacts
3. **Keep it simple** - Don't spawn agents for tasks you can do quickly yourself
