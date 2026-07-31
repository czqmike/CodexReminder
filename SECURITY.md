# Security Policy

## Supported versions

Security fixes are provided for the latest Marketplace version of Codex Reminder.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting page:

https://github.com/czqmike/CodexReminder/security/advisories/new

Do not disclose suspected vulnerabilities in a public issue until a fix is available. Include reproduction steps, affected versions, and impact, but never include real credentials, Codex authentication files, private session transcripts, or proprietary source code.

## Data and execution boundary

Codex Reminder:

- Reads local Codex session JSONL files and the current Extension Host's `Codex.log`.
- Stores unread counts in VS Code workspace state.
- Does not send telemetry or make outbound network requests.
- On Windows, invokes the bundled `scripts/set-taskbar-badge.ps1` with an argument array to update the current VS Code window's taskbar overlay.
- Does not execute code from the opened workspace.
