# CDP (Chrome DevTools Protocol) Debugging Guide for Kiro IDE

Guide for AI agents (Copilot, Cursor, etc.) to debug and inject JavaScript into Kiro IDE using CDP.

## Prerequisites

- Kiro IDE installed at `/usr/share/kiro/`
- Node.js available
- `chrome-remote-interface` npm package (installed in `kiro-debug/`)

## 1. Launch Kiro with CDP Enabled

```bash
# Kill existing instances and start with debug port
pkill -f "kiro" 2>/dev/null
sleep 2
kiro --remote-debugging-port=9333 &>/dev/null &
```

Wait ~15 seconds for Kiro to fully load, then verify:

```bash
curl -s http://localhost:9333/json/version | head -5
```

Expected output includes `"Browser": "Chrome/..."` and `"webSocketDebuggerUrl"`.

## 2. List CDP Targets

```bash
curl -s http://localhost:9333/json/list | python3 -m json.tool
```

Kiro exposes 3 targets:

| Index | Type     | Description                          | URL Prefix             |
|-------|----------|--------------------------------------|------------------------|
| 0     | `page`   | Main workbench (top frame)           | `vscode-file://`       |
| 1     | `iframe` | Kiro Agent webview (has the UI)      | `vscode-webview://`    |
| 2     | `worker` | Background worker                    | (empty)                |

The **iframe target** (index 1) with `extensionId=kiro.kiroAgent` in its URL is where the Kiro Chat UI lives.

## 3. Kiro Iframe Structure (Critical Knowledge)

```
workbench.html (top frame, vscode-file://)
  └── iframe.webview.ready (vscode-webview://)        ← "outer context" (Context 1)
        └── iframe#active-frame (vscode-webview://)   ← "inner context" (Context 2) — Kiro UI here
```

### Key Facts

- **Top frame → outer iframe**: CROSS-ORIGIN. `contentDocument` returns `null`. Cannot be bridged.
- **Outer iframe → active-frame**: SAME ORIGIN. `contentDocument` works. This is how our auto-click script works.
- **Top frame has NO Node.js APIs**: `require`, `process`, `module` are all `undefined`. The `require('electron').webFrame` approach does NOT work.
- When connecting to the iframe CDP target, you get **2 execution contexts**:
  - **Context 1** (outer): The `index.html` host. Has `iframe#active-frame`. Can access inner DOM via `contentDocument`.
  - **Context 2** (inner): The `active-frame`. Has the actual Kiro UI buttons.

## 4. Using the Debug Tools

### `inject.js` — General-purpose script injector

```bash
cd kiro-debug/

# List all targets
node inject.js dummy.js

# Inject a script into a specific target (by index)
node inject.js ../auto-kiro-webview.js 1
```

### `read-console-logs.js` — Stream console output from all targets

```bash
# Watch all targets
node read-console-logs.js

# Watch a specific target by index (e.g., index 2 = Kiro webview)
node read-console-logs.js 2

# Custom port
node read-console-logs.js 2 9333
```

Streams `console.log/warn/error`, uncaught exceptions, and non-JS messages (network, CSS) with timestamps.

### `find-run-button.js` — Search all targets/contexts for the Run button

```bash
node find-run-button.js
```

Connects to every target, enumerates all execution contexts, and tries to find/click the Kiro Run button in each. Reports what it finds.

### `diagnose-autoclick.js` — Check if auto-click script is loaded

```bash
node diagnose-autoclick.js
```

Connects to the kiroAgent iframe target and checks each execution context for:
- Whether `window.__autoKiroStop` is defined (proves `auto-kiro-webview.js` executed)
- Whether kiro-buttons are visible (lists button texts)
- The `extensionId` URL parameter and context URL

Use this when auto-click isn't working to determine if the script loaded at all.

## 5. Injecting JavaScript via CDP (Programmatic)

```javascript
const CDP = require('chrome-remote-interface');

async function injectIntoKiroWebview(code) {
    const targets = await CDP.List({ port: 9333 });
    const kiroTarget = targets.find(t =>
        t.type === 'iframe' && t.url && t.url.includes('kiroAgent')
    );
    
    const client = await CDP({ target: kiroTarget.id, port: 9333 });
    const { Runtime } = client;

    // IMPORTANT: Register context handler BEFORE Runtime.enable()
    const contexts = [];
    Runtime.executionContextCreated(p => contexts.push(p.context));
    await Runtime.enable();
    await new Promise(r => setTimeout(r, 1500));  // wait for contexts

    // Context 1 = outer (index.html), Context 2 = inner (active-frame)
    const outerCtx = contexts.find(c => c.id === 1);
    const innerCtx = contexts.find(c => c.id === 2);

    // To click buttons, use the OUTER context (it can reach active-frame via contentDocument)
    const result = await Runtime.evaluate({
        expression: code,
        contextId: outerCtx.id,  // or innerCtx.id for direct access
        returnByValue: true,
    });

    console.log(result.result?.value);
    await client.close();
}
```

### Gotcha: Register `executionContextCreated` BEFORE `Runtime.enable()`

If you register after, you'll see 0 contexts. The events fire during `enable()`.

## 6. Accessing the Kiro Run Button

The Run button appears inside `div.kiro-snackbar-actions` when Kiro prompts for confirmation:

```html
<button class="kiro-button" data-size="small" data-variant="primary" data-purpose="alert">Run</button>
```

### From outer context (Context 1) — reaching through active-frame:

```javascript
var frame = document.getElementById('active-frame');
var doc = frame.contentDocument;
var candidates = doc.querySelectorAll('button.kiro-button[data-variant="primary"][data-purpose="alert"]');
var btn = Array.from(candidates).find(b => b.textContent.trim().includes('Run'));
if (btn) btn.click();
```

### From inner context (Context 2) — direct DOM access:

```javascript
var candidates = document.querySelectorAll('button.kiro-button[data-variant="primary"][data-purpose="alert"]');
var btn = Array.from(candidates).find(b => b.textContent.trim().includes('Run'));
if (btn) btn.click();
```

## 7. Useful Diagnostic Snippets

### Check what's in a context

```javascript
(function(){
    return JSON.stringify({
        url: window.location.href.substring(0, 80),
        buttons: document.querySelectorAll('button').length,
        kiroButtons: document.querySelectorAll('button.kiro-button').length,
        iframes: document.querySelectorAll('iframe').length,
        hasRequire: typeof require !== 'undefined',
    });
})();
```

### Check if outer context can access active-frame

```javascript
(function(){
    var f = document.getElementById('active-frame');
    if (!f) return 'no active-frame';
    try { return f.contentDocument ? 'ACCESSIBLE' : 'null'; }
    catch(e) { return 'BLOCKED: ' + e.message; }
})();
```

## 8. How the Production Auto-Click Works

Two scripts are patched into Kiro's HTML files by `patch_workbench_html()` (defined in `auto-click-on-chat/patch_workbench_html.sh`):

| File                     | Injected Into                                    | Purpose                        |
|--------------------------|--------------------------------------------------|--------------------------------|
| `auto-kiro.js`           | `workbench.html` (top frame)                     | Custom icon in toolbar         |
| `auto-kiro-webview.js`   | `webview/.../pre/index.html` (webview host)      | Auto-click Run button          |

The webview script only activates when `extensionId=kiro.kiroAgent` is in the URL params, so it doesn't affect other webviews.

### Apply patches

```bash
source ~/repo/AI-stuffs/auto-click-on-chat/patch_workbench_html.sh
patch_workbench_html_kiro     # icon customizations → workbench.html
patch_webview_html_kiro       # auto-click → webview index.html
```

## 9. Debugging: Script Injected But Not Running

If the auto-click script is in the HTML but `window.__autoKiroStop` is `undefined` (check via `diagnose-autoclick.js`), the most likely cause is **CSP (Content-Security-Policy)** blocking the inline script.

### Symptoms
- Script is present in the HTML file (grep for `VSCODE-CUSTOM-CSS` shows markers)
- `diagnose-autoclick.js` shows `autoKiroStop=undefined` in all contexts
- No errors visible — CSP silently blocks the script

### Root Cause
The `<meta http-equiv="Content-Security-Policy">` tag restricts which scripts can run. If the `patch_workbench_html` function fails to remove it, injected inline scripts are blocked. The CSP uses a `script-src` directive with a SHA-256 hash whitelist — only the original page script matches.

### How to Diagnose

1. Check if CSP tag still exists in the patched file:
   ```bash
   grep -c 'http-equiv="Content-Security-Policy"' /path/to/patched.html
   ```
   If count > 0 (excluding JS code references), CSP was not removed.

2. Check the tag format — the perl regex must handle both:
   - Self-closing: `<meta ... />` (VSCode/Antigravity/Windsurf workbench.html)
   - Normal closing: `<meta ... >` (Kiro webview index.html)

3. Run `diagnose-autoclick.js` to check if the script executed:
   ```bash
   cd kiro-debug && node diagnose-autoclick.js
   ```

### Fix
The CSP removal regex in `patch_workbench_html.sh` uses `\/?>`  to match both tag styles. If you see CSP still present after patching, check that the regex handles the specific tag format in the target HTML file.
