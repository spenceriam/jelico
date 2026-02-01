# Artifacts

Artifacts are persistent, visual outputs displayed in the Canvas panel. Use them for substantial content that benefits from rich rendering.

## Artifact Types

### code
Code snippets or files with syntax highlighting.
- Specify `language` parameter (e.g., "typescript", "python", "rust")
- User can copy, download, or edit

### html
Interactive HTML content rendered in a sandboxed iframe.
- Include all CSS and JavaScript inline
- Perfect for: games, interactive demos, visualizations, tools
- JavaScript onclick handlers and interactivity work

### document
Markdown documents with full formatting.
- Supports headings, lists, code blocks, tables
- Rendered with syntax highlighting for code blocks

### svg
SVG graphics rendered visually.
- Vector graphics, diagrams, icons
- Scalable and downloadable

### mermaid
Mermaid diagram syntax rendered as diagrams.
- Flowcharts, sequence diagrams, class diagrams, etc.
- See Mermaid documentation for syntax

## Creating Artifacts

### Via Sub-Agent (PREFERRED)
For substantial artifacts, delegate to a sub-agent:
```
spawn_agent({
  task: "Create an interactive calculator as an HTML artifact with embedded CSS and JavaScript. Include buttons for digits 0-9, operations (+, -, *, /), equals, and clear.",
  name: "CalculatorCreator"
})
wait_for_agent({ agent_id: "..." })
```

Benefits:
- Keeps your context clean
- Sub-agent focuses entirely on the artifact
- You can review and request fixes

### Direct Creation (for trivial artifacts)
Only use `create_artifact` directly for very simple artifacts:
```
create_artifact({
  type: "code",
  title: "Hello World",
  content: "console.log('Hello, World!')",
  language: "javascript"
})
```

## Artifact Streaming

When an artifact is created:
1. Content streams to the Canvas in real-time
2. User sees an "Editor" tab with the raw content building
3. When complete, switches to "Preview" tab for rendered view
4. User can toggle between Editor (editable) and Preview

## Reviewing Artifacts

After a sub-agent creates an artifact, review it:

**Check the content in the result:**
- Is the code correct and complete?
- Are there any syntax errors?
- Does it meet all requirements?

**Check visually (the user can see it too):**
- Does the preview look correct?
- Are there layout or styling issues?
- Does interactivity work?

If issues found, use `continue_agent` to request fixes before reporting success.

## Mermaid Diagram Types

Choose the right diagram for the concept:

| Type | Use For | Example |
|------|---------|---------|
| flowchart | Processes, decisions | User registration flow |
| sequenceDiagram | Interactions over time | API request/response |
| classDiagram | OOP structures | Domain models |
| stateDiagram | State machines | Order lifecycle |
| erDiagram | Database schemas | User-posts-comments |
| gantt | Project timelines | Sprint planning |
| mindmap | Brainstorming | Feature ideas |
| pie | Proportions | Budget breakdown |
| gitGraph | Branch strategies | GitFlow |

## Best Practices

1. **Self-contained HTML**: Include all CSS and JS inline - no external dependencies
2. **Meaningful titles**: "Interactive Todo App" not "artifact1"
3. **Responsive design**: Consider different Canvas sizes
4. **Error handling**: Include basic error states in interactive artifacts
5. **Delegate complex artifacts**: Use sub-agents for anything more than a few lines
