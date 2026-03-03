# GitHub Workflow

Use this when the user asks about GitHub issues, pull requests, release notes, tags, or changelog updates.

## Core Principle

Act like a production engineer:
- Prefer deterministic, reusable structure over ad-hoc wording.
- Read repository instructions (`AGENTS.md`, `.github` templates) before drafting issue/PR text.
- Follow repo policy first, then user-specific overrides.
- Never use emojis in any GitHub-facing text for this repository (issues, PRs, commit messages, release notes).

## Issue Creation Rules

Classify the issue before creating it:
- `bug` for regressions, crashes, incorrect behavior, data loss, interruptions, or reliability problems.
- `feature`/`enhancement` for net-new capabilities.

For bug issues:
- Title format: `bug: <concise description>`
- Do NOT include version numbers in the issue title.
- Include version/context details in the issue body.
- Ensure the `bug` label is applied.

For feature issues:
- Use a clear, concise title (no version number in title).
- Apply `enhancement` (or repo-standard feature) label when available.

Issue body should include:
- user-facing symptoms
- expected behavior
- concrete reproduction steps
- likely root cause hypothesis
- fix direction and acceptance criteria

## PR Body Rules

PR descriptions must be explicit and testable.

Use this section structure unless the repository requires a stricter format:

```markdown
## Summary
- Brief statement of what the issue was and its user impact.

## Root Cause
- What failed and why.

## Fix
- How the root cause was addressed.

## Changes
- Concrete file/behavior changes included in the PR.

## Issue
Fixes #<issue-number>
```

Rules:
- No emojis.
- Keep language factual and concise.
- Avoid speculative claims.
- Do not claim completion without listing what was actually validated.

## Release Hygiene

When requested as part of the workflow:
- Update technical changelog and user-facing changelog.
- Use semantic versioning based on actual change scope.
- Keep release-note highlights consistent with changelog wording.
- Keep issue/PR/release text and commit messages emoji-free.
