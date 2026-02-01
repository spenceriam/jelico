# Claude Code System Prompts Analysis

Analysis of https://github.com/Piebald-AI/claude-code-system-prompts for Jelico improvements.

## Executive Summary

Claude Code has **116 system prompt files** organized into categories:
- **Agent prompts** - Specialized sub-agents for specific tasks
- **System prompts** - Core behavior and policies
- **System reminders** - Context-aware notifications injected during execution
- **Tool descriptions** - Detailed documentation for each tool
- **Skills** - Slash command implementations

## High-Value Improvements for Jelico

### 1. 🔴 CRITICAL: Enhanced Todo/Task System

**Current Jelico Problem**: Todo tools exist but AI rarely uses them.

**Claude Code Approach**:
- Detailed examples of WHEN to use and NOT use todos
- System reminder periodically nudges AI to use todos
- Task completion requirements (don't mark done if tests fail)
- Active form for tasks ("Running tests" vs "Run tests")

**Recommended Changes**:

```markdown
## System Reminder (inject periodically)
The task tools haven't been used recently. If you're working on tasks that
would benefit from tracking progress, consider using todo_write to track
progress. Only use it if relevant - ignore if not applicable.
```

**Examples to add to prompt**:
- User asks to "fix all type errors" → Create todo for each error
- User asks "what does X do?" → NO todo needed (informational)
- User asks to "add dark mode" → Create todos for each implementation step

---

### 2. 🟡 HIGH VALUE: Plan Mode

**Claude Code Feature**: Formal plan mode with user approval before implementation.

**When to use**:
- New feature implementation with architectural decisions
- Multiple valid approaches exist
- Multi-file changes (3+ files)
- Unclear requirements needing exploration

**Implementation for Jelico**:
1. Add `switch_mode("plan", reason)` at start of complex tasks
2. Explore codebase (read-only)
3. Present plan to user
4. Get approval before executing
5. Switch to execute mode

**Benefits**:
- Prevents wasted effort on wrong approach
- User feels consulted on their codebase
- Better outcomes for complex tasks

---

### 3. 🟡 HIGH VALUE: Conversation Summarization Template

**Current Jelico**: Basic compaction with tool output pruning.

**Claude Code Template** (much more structured):
```markdown
1. Primary Request and Intent - What did user explicitly ask for?
2. Key Technical Concepts - Technologies/frameworks discussed
3. Files and Code Sections - Files examined/modified with code snippets
4. Errors and Fixes - Problems encountered and solutions
5. Problem Solving - What was solved, what's ongoing
6. All User Messages - Complete list (not tool results)
7. Pending Tasks - Explicitly requested but not done
8. Current Work - What was happening before summarization
9. Optional Next Step - Only if directly in line with recent work
```

**Benefits**:
- Better context preservation across compaction
- Avoids losing important decisions or errors
- Next step ensures continuity

---

### 4. 🟡 HIGH VALUE: Explore Agent Improvements

**Claude Code Explore Agent**:
- **CRITICAL: Read-only mode** - Cannot create/modify files
- Optimized for fast parallel searches
- Returns absolute file paths
- Efficient tool usage patterns

**Recommended for Jelico sub-agents**:
```markdown
=== READ-ONLY MODE ===
You are STRICTLY PROHIBITED from:
- Creating new files
- Modifying existing files
- Running commands that change state

Your role is EXCLUSIVELY to search and analyze.
```

---

### 5. 🟢 MEDIUM VALUE: Git Safety Protocols

**Claude Code Git Rules**:
- NEVER update git config
- NEVER run destructive commands without explicit request
- NEVER skip hooks (--no-verify)
- NEVER force push to main/master
- ALWAYS create NEW commits (not amend) unless asked
- Use HEREDOC for commit messages (proper formatting)
- Add specific files, not `git add -A`

**Jelico should adopt these** in execute_command permission checks.

---

### 6. 🟢 MEDIUM VALUE: Security Review Skill

**Claude Code has `/security-review`**:
- Analyzes git diff for vulnerabilities
- Categories: SQL injection, XSS, auth bypass, hardcoded secrets
- Confidence scoring (only report >80% confidence)
- False positive filtering rules
- Outputs structured markdown report

**Could add to Jelico as a slash command** for code review.

---

### 7. 🟢 MEDIUM VALUE: Remember Skill (Session Memory)

**Claude Code `/remember`**:
- Reviews session memories
- Extracts patterns that appear in 2+ sessions
- Updates CLAUDE.local.md with learnings
- Requires user confirmation before changes

**Jelico has Soul system** but could add:
- Explicit "remember this" skill
- 2+ session threshold for patterns
- User confirmation before adding patterns

---

### 8. 🟢 MEDIUM VALUE: Learning Mode

**Claude Code Learning Mode**:
- Encourages learning through hands-on practice
- Asks user to contribute 2-10 line code pieces
- `TODO(human)` markers in code
- "Learn by Doing" prompts

**Jelico could add** as optional mode for educational contexts.

---

### 9. 🟢 MEDIUM VALUE: Tool Usage Policy

**Key policies from Claude Code**:
1. Parallel tool calls when no dependencies
2. Use specialized tools instead of bash (Read vs cat)
3. Use explore agent for codebase questions
4. Never use bash to communicate (no echo for messages)

**Jelico already has some of this** but could reinforce.

---

### 10. 🟡 HIGH VALUE: Ask User Question Tool

**Claude Code AskUserQuestion**:
- Structured multiple choice questions
- Options with descriptions
- Multi-select support
- "(Recommended)" label for preferred option
- "Other" always available

**Jelico could implement** for clearer user interaction.

---

## Implementation Priority

### Phase 1: Quick Wins (1-2 days)
1. ✅ Add todo usage examples and when NOT to use
2. Add system reminder for todo usage
3. Add git safety protocols to permission checker
4. Improve conversation summarization template

### Phase 2: Medium Effort (3-5 days)
1. Implement plan mode with user approval
2. Add explore agent read-only restrictions
3. Add AskUserQuestion structured prompts
4. Enhance sub-agent prompts with Claude Code patterns

### Phase 3: New Features (1+ week)
1. `/security-review` skill
2. `/remember` skill with 2+ session threshold
3. Learning mode (optional)

---

## Files to Create/Modify

### New Prompt Files
- `electron/prompts/capabilities/task-tracking.md` - Detailed todo examples
- `electron/prompts/system-reminders/todo-reminder.md` - Periodic nudge
- `electron/prompts/system-reminders/compaction-template.md` - Summarization template
- `electron/prompts/skills/security-review.md` - Security review skill
- `electron/prompts/skills/remember.md` - Remember skill

### Modified Files
- `electron/prompts/core/persona.md` - Add plan mode, git safety
- `electron/prompts/capabilities/tools.md` - Enhance todo section
- `electron/services/subagents.ts` - Read-only mode for explore
- `electron/services/compaction.ts` - Better summarization template
- `electron/services/permissionChecker.ts` - Git safety rules

---

## Key Takeaways

1. **Claude Code is very explicit** about WHEN to use tools and WHEN NOT to
2. **System reminders** periodically nudge correct behavior
3. **Plan mode** prevents wasted effort on wrong approaches
4. **Explore agents are read-only** - cannot modify anything
5. **Git operations have strict safety protocols**
6. **Summarization is highly structured** to preserve context
7. **Skills/slash commands** provide specialized workflows
