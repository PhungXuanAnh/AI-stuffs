# Task Completion Checklist

Since there is no build pipeline, linting, or test suite, when completing a task:

1. **Review the change** — re-read the modified file to confirm correctness
2. **Check for consistency** — if adding/modifying a button selector or pattern shared across scripts, check all relevant `.js` files in `auto-click-on-chat/`
3. **Verify no syntax errors** — use `node --check <file>` to parse check a JS file for syntax errors
4. **Git commit** — `git add -A && git commit -m "descriptive message"`

## Syntax Check Command
```bash
node --check auto-click-on-chat/<filename>.js
```

## Key Reminder
- Scripts in `auto-click-on-chat/` are deployed by patching IDE HTML files at OS install time
- There is no hot-reload; a re-patch or IDE restart is required to test changes in real IDE
- The `debug-scripts/` tooling (inject.js, find-run-button.js) can be used to test changes live via CDP without patching
