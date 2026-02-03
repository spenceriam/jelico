# Contributing to Jelico

Thanks for your interest in contributing to Jelico. This project is a local-first AI desktop assistant built with Electron, React, and TypeScript.

## Code of Conduct

Be respectful and constructive. Harassment, discrimination, or abusive behavior is not tolerated.

## Getting Started

1. Fork the repo and create a feature branch.
2. Install dependencies with `npm install`.
3. Start the dev server with `npm run dev`.

## Development Workflow

1. Make your changes in small, focused commits.
2. Run `npm run build` to ensure TypeScript and build steps pass.
3. Open a pull request with a clear description and screenshots if UI changes are included.

## Project Structure

- `electron/` - Electron main process and IPC handlers
- `src/` - React renderer
- `src/components/` - UI components
- `src/stores/` - Zustand stores
- `src/lib/` - Utilities
- `src/data/` - Static data and changelog

## Changelog and Versioning

When changes are user-facing, update `src/data/changelog.ts` before bumping the version. Use semantic versioning:

- PATCH: Bug fixes, small improvements, performance
- MINOR: New features or significant enhancements
- MAJOR: Breaking changes or migrations

If you are unsure, open an issue or ask in your PR description.

## Reporting Issues

Please include:

- Clear repro steps
- Expected behavior
- Actual behavior
- Screenshots or logs if helpful

## License

By contributing, you agree that your contributions will be licensed under GPL-3.0-or-later.
