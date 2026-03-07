# Suggested Commands

## Development / Debug

### Install kiro-debug dependencies
```bash
cd auto-click-on-chat/kiro-debug && npm install
```

### Launch Kiro with CDP (remote debugging)
```bash
pkill -f "kiro" 2>/dev/null
sleep 2
kiro --remote-debugging-port=9222 &>/dev/null &
```

### Verify CDP connectivity
```bash
curl -s http://localhost:9222/json/version | head -5
curl -s http://localhost:9222/json/list | python3 -m json.tool
```

### List CDP targets and inject a script
```bash
# List targets only
node auto-click-on-chat/kiro-debug/inject.js <any-script-file>

# Inject into target by index (e.g., index 1 = Kiro webview)
node auto-click-on-chat/kiro-debug/inject.js <script-file> 1
```

### Find Run button across all CDP contexts
```bash
node auto-click-on-chat/kiro-debug/find-run-button.js
```

## Git
```bash
git status
git add -A && git commit -m "message"
git log --oneline -10
```

## No build / test / lint commands
This project has no build pipeline, tests, or linter. Scripts are injected directly into IDE HTML files at OS install/setup time.
