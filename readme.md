# AI-stuffs

Auto-click confirmation buttons and inject custom JS into VS Code-based IDEs (VSCode, Kiro, Antigravity, Windsurf).

## Project Structure

```
auto-click-on-chat/
├── patch_workbench_html.sh    # Core patching function + IDE-specific wrappers
├── auto-vscode.js             # VSCode workbench customizations
├── auto-kiro.js               # Kiro workbench customizations (toolbar icon)
├── auto-kiro-webview.js       # Kiro webview auto-click (Run button)
├── auto-antigravity.js        # Antigravity workbench customizations
├── auto-windsurf.js           # Windsurf workbench customizations
├── auto-click-confirm.js      # Generic auto-click confirm script
└── kiro-debug/                # CDP debugging tools for Kiro
    ├── inject.js              # General-purpose CDP script injector
    ├── find-run-button.js     # Search all contexts for Run button
    ├── find-waiting-buttons.js # Find buttons in "Waiting on your input" container
    ├── read-console-logs.js   # Stream console output from all CDP targets
    ├── diagnose-autoclick.js  # Diagnose if auto-click script loaded correctly
    ├── package.json           # Dependencies (chrome-remote-interface)
    └── CDP-DEBUGGING-GUIDE.md # Detailed CDP debugging guide
```

## How It Works

### The Patching System

`patch_workbench_html.sh` injects JavaScript into IDE HTML files at build time. It:

1. Removes any existing custom patches (idempotent — safe to run repeatedly)
2. Removes the Content-Security-Policy `<meta>` tag so inline scripts can execute
3. Wraps the JS file content in `<script>` tags with VSCODE-CUSTOM-CSS markers
4. Injects the block before `</html>` in the target HTML file

This is sourced by `~/Dropbox/Work/Other/conf.d/alias/new-os-install-Ubuntu.sh` and called during IDE installation.

### Usage

```bash
# Source the script (done automatically by new-os-install-Ubuntu.sh)
source ~/repo/AI-stuffs/auto-click-on-chat/patch_workbench_html.sh

# Patch individual IDEs
patch_workbench_html_vscode
patch_workbench_html_kiro       # workbench.html (toolbar icon)
patch_webview_html_kiro         # webview index.html (auto-click Run)
patch_workbench_html_antigravity
patch_workbench_html_windsurf

# Or patch any HTML file with any JS file
patch_workbench_html /path/to/workbench.html /path/to/custom.js
```

### Kiro: Why Two Scripts?

Kiro requires **two separate scripts** injected into **two different HTML files** because of its iframe architecture:

```
workbench.html (top frame, vscode-file://)
  └── iframe.webview.ready (vscode-webview://)     ← CROSS-ORIGIN boundary
        └── iframe#active-frame (vscode-webview://) ← Kiro chat UI lives here
```

- **`auto-kiro.js`** → `workbench.html` — Adds green check icon to toolbar. Runs in the top frame.
- **`auto-kiro-webview.js`** → `webview/pre/index.html` — Auto-clicks the "Run" button. Runs inside the webview host, which is same-origin with `active-frame` and can access the button DOM via `contentDocument`.

These **cannot be merged** because the cross-origin iframe boundary between `workbench.html` and the webview prevents the workbench script from reaching the Run button.

## CSP Bug Fix History

The `patch_workbench_html` function removes CSP `<meta>` tags using a perl regex. The original regex expected self-closing tags (`/>`), but Kiro's webview `index.html` used a normal closing tag (`>`). This caused the CSP to remain, silently blocking the injected script.

**Fix:** Changed the regex from `\/>` to `\/?>` (making `/` optional) to handle both tag styles.

Verification after fix (all IDEs patched correctly):

| IDE | CSP meta tags remaining | VSCODE-CUSTOM-CSS markers | Status |
|---|---|---|---|
| VSCode | 0 | 3 | OK |
| Kiro workbench | 0 | 3 | OK |
| Kiro webview | 1 (JS code reference, not a tag) | 3 | OK |
| Antigravity | 0 | 3 | OK |
| Windsurf | 0 | 3 | OK |