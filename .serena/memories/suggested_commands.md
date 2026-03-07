# Suggested Commands

## Development / Debug

### Install debug-scripts dependencies
```bash
cd debug-scripts && npm install
```

### Launch Kiro with CDP (remote debugging)
```bash
pkill -f "kiro" 2>/dev/null
sleep 2
kiro --remote-debugging-port=9333 &>/dev/null &
```

### Verify CDP connectivity
```bash
curl -s http://localhost:9333/json/version | head -5
curl -s http://localhost:9333/json/list | python3 -m json.tool
```

### List CDP targets and inject a script
```bash
# List targets only
node debug-scripts/inject.js <any-script-file>

# Inject into target by index (e.g., index 1 = Kiro webview)
node debug-scripts/inject.js <script-file> 1
```

### Find Run button across all CDP contexts
```bash
node debug-scripts/find-run-button.js
```

## Git
```bash
git status
git add -A && git commit -m "message"
git log --oneline -10
```

## No build / test / lint commands
This project has no build pipeline, tests, or linter. Scripts are injected directly into IDE HTML files at OS install/setup time.
