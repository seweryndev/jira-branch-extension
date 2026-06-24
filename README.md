# Branch Name Builder – Jira

Internal Chrome extension (Manifest V3) that generates a Git branch name from the
currently open issue in our local Jira instance (Server / Data Center) and copies it
straight to the clipboard.

## Installation (unpacked extension, internal tool)

This is an internal tool and is **not** published on the Chrome Web Store — every
developer loads it locally as an "unpacked extension":

1. Get the `jira-branch-extension` folder onto your machine (clone/pull this repo).
2. Open `chrome://extensions` in Chrome.
3. Toggle **"Developer mode"** on, top-right corner.
4. Click **"Load unpacked"**.
5. Select the `jira-branch-extension` folder — the one that directly contains `manifest.json`.
6. The extension appears in the list and is active immediately. Click the puzzle-piece
   icon in the toolbar and pin it for quick access.

### Updating after a code change

Whenever `manifest.json`, `popup.html`, or `popup.js` changes (e.g. after a `git pull`):

1. Go to `chrome://extensions`.
2. Click the refresh icon (⟳) on the extension's card.
3. If the popup was open, close and reopen it so it picks up the new `popup.js`.

### Uninstalling

On `chrome://extensions`, find the card and click **"Remove"**.

## Usage

1. Open a specific issue in Jira — either the classic issue view (`/browse/PROJ-123`)
   or the detail side-panel opened from a board (e.g. "Active sprints").
2. Click the extension icon.
3. Pick the branch type: **Feature** (default) or **Bugfix**.
4. Click **"Wygeneruj i skopiuj nazwę brancha"**.
5. The branch name (`feature/PROJ-123-issue-title`) is now on your clipboard — paste it
   wherever you need it (e.g. `git checkout -b <pasted-name>`).

The popup shows a green success message with the generated name, or a red error if no
issue data could be found on the current tab.

## File structure

- `manifest.json` – extension config (`activeTab` + `scripting` permissions, popup action).
- `popup.html` – popup UI (Feature/Bugfix toggle, button, status area).
- `popup.js` – logic: reads the active tab, injects a script into the Jira page,
  formats the branch name, writes it to the clipboard.

## How data extraction works

`popup.js` injects a self-contained `extractJiraIssueData()` function into the active
tab (via `chrome.scripting.executeScript`). It tries several selectors in order, since
different Jira views render the same data differently:

**Issue key**, in order:
1. `#key-val` – classic issue view.
2. `[data-issuekey]` – attribute on the detail-panel container (e.g. "Active sprints" board).
3. `[data-issue-key]` – hyphenated variant used by some themes.
4. `[data-field-id="issuekey"] a` – link inside the issuekey field.
5. Fallback: the first `a[href*="/browse/"]` link on the page — key parsed out of the URL
   (works almost everywhere, since a `/browse/...` link also shows up in breadcrumbs).

**Title/summary**, in order:
1. `#summary-val`
2. `[data-field-id="summary"]`
3. `.ghx-summary` – board detail panel.
4. `h1[id^="summary"]`

If your Jira instance uses a heavily customized theme and none of these match, add
another selector at the start of the relevant list inside `extractJiraIssueData()` in
`popup.js` — the rest of the logic (title sanitization, name formatting, clipboard
write) stays untouched.

## Permissions

- `activeTab` – access to the active tab only at the moment the popup button is
  clicked, no standing access to every page.
- `scripting` – allows injecting `extractJiraIssueData()` into that tab.

No `host_permissions` are declared, and no data leaves the machine except into the
user's own system clipboard.

## Branch naming convention

```
{feature|bugfix}/{ISSUE-KEY}-{title-with-hyphens}
```

e.g. `feature/ROBO-545-remove-welding-presets-from-appsettings`.
