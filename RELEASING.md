# Releasing Codex Reminder

## Automation contract

- A normal push to `master` runs the cross-platform test suite and uploads a verified VSIX as a GitHub Actions artifact. It does not create a public release or publish to Marketplace.
- Pushing an exact `vX.Y.Z` tag is the explicit release action. The tag, `package.json`, and `CHANGELOG.md` versions must match.
- The release workflow builds the VSIX once, attaches that exact file to the GitHub Release, and only then publishes the same artifact to Marketplace through OIDC. Rerunning it replaces a missing or incomplete VSIX asset without creating a duplicate Release.
- Marketplace versions are immutable. Increment `package.json` before every new release; never reuse a version number.

## Repository-side release

1. Use Node.js 22 and run `npm ci`.
2. Update `package.json` and add a dated `CHANGELOG.md` section with the same SemVer version.
3. Run:

   ```powershell
   npm run check
   npm run test:taskbar
   npm run verify:package
   node scripts/check-release.js v1.0.0
   code --install-extension .\dist\codex-reminder.vsix --force
   ```

4. Complete the Windows acceptance scenarios in this document.
5. Commit the release changes, then create and push an exact lowercase `vX.Y.Z` tag. Git actions are intentionally manual.

   For the `v1.0.1` release prepared on `master`, run these commands individually:

   ```powershell
   node scripts/check-release.js v1.0.1
   npm run verify:package

   git add .github/workflows/ci.yml .github/workflows/release.yml CHANGELOG.md RELEASING.md
   git diff --cached

   git commit -m "ci: prepare v1.0.1 release"
   git tag -a v1.0.1 -m "Codex Reminder v1.0.1"

   git push origin master
   git push origin v1.0.1
   ```

   The final command triggers the Release workflow. If repository variable
   `MARKETPLACE_OIDC_ENABLED` is `true`, it also starts the Marketplace job,
   subject to the `marketplace` environment approval rules.

6. The release workflow builds one `dist/codex-reminder.vsix`, verifies it, uploads it as a workflow artifact, and attaches the same file to the GitHub Release.

## First Marketplace release

1. Sign in to the [Visual Studio Marketplace publisher management page](https://marketplace.visualstudio.com/manage/publishers/).
2. Confirm that Publisher ID `czqmike` is available. If it is unavailable, stop; do not choose a replacement without an explicit project decision.
3. Create the publisher, then download `codex-reminder-vsix` from the successful `v1.0.0` release workflow.
4. Install and test that exact artifact locally.
5. Upload the same VSIX through the publisher management page and wait for Marketplace validation and scanning.
6. Verify the public page, install action, publisher, version, dependency, screenshots, repository, license, support links, and search result.

If publisher bootstrap unexpectedly requires a Personal Access Token, create a short-lived token with only `Marketplace: Manage`, never store it in the repository or GitHub, and revoke it immediately after bootstrap.

## Enable keyless updates

After the first Marketplace version is public:

1. In the Marketplace publisher settings, create a trusted publishing policy for:
   - GitHub owner: `czqmike`
   - Repository: `CodexReminder`
   - Workflow: `.github/workflows/release.yml`
2. In GitHub, create an Environment named `marketplace` and require a maintainer approval.
3. Set repository variable `MARKETPLACE_OIDC_ENABLED` to `true`.
4. Future `vX.Y.Z` tags publish the already-verified VSIX with `vsce publish --packagePath dist/codex-reminder.vsix --oidc`.

No `VSCE_PAT` secret is used.

## Windows acceptance checklist

- A completed Codex reply increments both status bar and taskbar count while VS Code is unfocused.
- `request_user_input` increments the count.
- A reply already visible in the active conversation is not counted.
- Returning to the active conversation clears its count.
- Multiple windows count only their own workspace threads.
- Reloading VS Code restores unread state.
- The clear command and disabled setting remove the overlay.
- Values over `codexReminder.maxTaskbarCount` display the configured maximum plus `+`.
- SSH/WSL/Dev Container usage runs Codex Reminder in the local UI Extension Host.

## Failure handling

Never delete a Marketplace extension or attempt to reuse a published version number. For a critical release, temporarily unpublish it, make a forward fix with a higher patch version, repeat validation, and publish the new version.
