# Code Style & Conventions

## Language
- Pure Vanilla JavaScript (ES5/ES6 mix) — no TypeScript, no build tools, no transpilation
- Serena may detect "typescript" but the files are all `.js`

## Patterns
- IIFE (Immediately Invoked Function Expression) wraps all main logic: `(function() { 'use strict'; ... })();`
- `'use strict'` inside IIFEs
- `setInterval`-based polling to wait for DOM elements to appear
- `var` in older sections, `const`/`let` in newer sections
- `console.log` statements for debug output with distinguishing prefixes (e.g., `[auto-kiro]`, `===============>`)
- Guard clauses / early returns when target elements not found

## Naming
- Files: lowercase kebab-case (`auto-kiro-webview.js`, `find-run-button.js`)
- Variables: camelCase (`toolbarContainer`, `iconElement`, `findAndClickRunButton`)
- Constants: UPPER_SNAKE_CASE for config values (`CHECK_INTERVAL`, `BUTTON_SELECTOR`, `BUTTON_SELECTORS`)
- Functions: camelCase verb phrases (`addCustomIcon`, `waitAndAddIcon`, `findAndClickRunButton`)

## No Tests, No Linting
- No test framework defined
- No ESLint or Prettier config
- No `package.json` at root level

## Shared Pattern Across Scripts
All scripts contain a copy of these two helper functions:
- `addCustomIcon()` — adds green check icon to IDE toolbar
- `waitAndAddIcon()` — polls with setInterval until icon is added or max attempts reached
