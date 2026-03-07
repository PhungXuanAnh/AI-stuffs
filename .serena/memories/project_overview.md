# AI-stuffs Project Overview

## Purpose
Collection of vanilla JavaScript automation scripts that auto-click confirmation/approval buttons in AI IDE chat interfaces (VS Code, Kiro IDE, Windsurf, Antigravity). Reduces friction during AI agent tool execution by eliminating manual "Allow / Confirm / Run" clicks.

Also includes a script to remove unwanted UI icons from IDE workbenches.

## How They're Used
Scripts are injected into IDE HTML files via shell script functions (e.g., `patch_workbench_html_kiro()`, `patch_webview_html_kiro()`) in a separate `new-os-install-Ubuntu.sh` install script (not in this repo).

## Files & Purposes

| File | Target IDE | Button Clicked |
|------|-----------|----------------|
| `auto-click-on-chat/auto-vscode.js` | VS Code (Copilot Chat) | "Allow", "Allow Once", "Allow and Review", etc. |
| `auto-click-on-chat/auto-windsurf.js` | Windsurf IDE | "Confirm" / "Run" |
| `auto-click-on-chat/auto-antigravity.js` | Antigravity IDE | "Accept", "Confirm", "Allow This Conversation" |
| `auto-click-on-chat/auto-click-confirm.js` | Generic / Windsurf | "Confirm" button (iframe aware) |
| `auto-click-on-chat/auto-kiro.js` | Kiro IDE (workbench.html) | Custom icon + workbench UI tweaks |
| `auto-click-on-chat/auto-kiro-webview.js` | Kiro IDE (webview index.html) | "Run" button inside kiro.kiroAgent webview |
| `remove-some-icons.js` | Various IDEs | Removes specific toolbar icons |

## Kiro-Specific Architecture Finding
Kiro's "Run" button lives inside a nested cross-origin iframe structure:
```
workbench.html (vscode-file://)
  └── iframe.webview.ready (vscode-webview://)  <- CROSS-ORIGIN from workbench
        └── iframe#active-frame (same-origin)   <- Kiro Chat UI here
```
Solution: inject `auto-kiro-webview.js` into the webview index.html (same origin as active-frame), not into workbench.html.
