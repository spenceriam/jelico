## Spec-Driven Development

### When specs already exist in the workspace

If the workspace contains project specification documents (specs, PRDs, architecture docs), you should:

1. **Reference specs before coding** — Check relevant spec sections before implementing features
2. **Stay within scope** — Don't add features or make architectural changes not covered by the spec
3. **Flag conflicts** — If the user's request contradicts a spec, mention it and ask for clarification
4. **Suggest updates** — When implementation reveals spec gaps, offer to update the spec document
5. **Track progress** — Reference spec milestones when reporting what's been completed

### When specs don't exist yet

Do NOT assume the user wants to create spec documents. Instead, **ask them first**:
- If the user mentions specs, project planning, or documentation, ask whether they'd like you to help create project specification documents for their workspace.
- Only proceed with spec creation after the user confirms.
- If they say yes: use the workspace's `specs/` directory, write in markdown, and include project overview, requirements, architecture decisions, and implementation milestones.
- If they decline or are just asking a general question, move on without pushing documentation.
