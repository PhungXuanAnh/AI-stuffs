// Find the Run button and all buttons inside the "Waiting on your input" container
// Usage: node find-waiting-buttons.js [--click]
// --click flag will also click Run if found

const CDP = require('chrome-remote-interface');

const PORT        = 9333;
const TARGET_IDX  = 2;   // Kiro webview iframe (extensionId=kiro.kiroAgent)
const SHOULD_CLICK = process.argv.includes('--click');

// Runs inside outer context (index.html) → accesses Kiro UI via active-frame.contentDocument
const SEARCH_CODE = `
(function() {
    var result = { outerURL: window.location.href.substring(0, 80), contexts: {} };

    // ── Try outer context → active-frame ──────────────────────────────────────
    var frame = document.getElementById('active-frame');
    if (!frame) {
        result.outerCtx = 'no active-frame element';
    } else {
        var doc;
        try { doc = frame.contentDocument; } catch(e) { doc = null; result.outerCtxError = e.message; }
        if (!doc) {
            result.outerCtx = 'contentDocument null — will fall back to direct';
        } else {
            result.outerCtx = 'accessible';
            result = Object.assign(result, scanDoc(doc, 'outer→active-frame'));
        }
    }

    return JSON.stringify(result, null, 2);

    function scanDoc(doc, label) {
        var out = { label: label };

        // 1. Run button (exact selector from the HTML)
        var runCandidates = doc.querySelectorAll(
            'button.kiro-button[data-variant="primary"][data-purpose="alert"]'
        );
        out.runButtons = Array.from(runCandidates).map(function(b) {
            return {
                text:        b.textContent.trim(),
                dataActive:  b.getAttribute('data-active'),
                dataLoading: b.getAttribute('data-loading'),
                classes:     b.className,
            };
        });

        // 2. "Waiting on your input" container — walk upward from the text node
        //    to find a wrapper with a small, bounded subtree, then list all its buttons
        var walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null, false);
        var waitingContainer = null;
        var node;
        while ((node = walker.nextNode())) {
            if (node.nodeValue && node.nodeValue.includes('Waiting on your input')) {
                // Walk up until we find a reasonably scoped container
                var el = node.parentElement;
                while (el && el !== doc.body) {
                    var btns = el.querySelectorAll('button');
                    if (btns.length >= 1) { waitingContainer = el; break; }
                    el = el.parentElement;
                }
                break;
            }
        }

        if (waitingContainer) {
            var allBtns = waitingContainer.querySelectorAll('button');
            out.waitingContainer = {
                tag:      waitingContainer.tagName,
                id:       waitingContainer.id || '(none)',
                classes:  waitingContainer.className.substring(0, 100),
                innerText: waitingContainer.innerText.replace(/\\n/g, ' ').substring(0, 120),
                buttons: Array.from(allBtns).map(function(b) {
                    return {
                        text:        b.textContent.trim(),
                        classes:     b.className,
                        dataVariant: b.getAttribute('data-variant'),
                        dataPurpose: b.getAttribute('data-purpose'),
                        dataActive:  b.getAttribute('data-active'),
                        disabled:    b.disabled,
                    };
                }),
            };
        } else {
            out.waitingContainer = null;
            // Fallback: report ALL kiro-buttons found so we can see what's around
            var allKiro = doc.querySelectorAll('button.kiro-button');
            out.allKiroButtons = Array.from(allKiro).map(function(b) {
                return { text: b.textContent.trim(), classes: b.className };
            });
        }

        return out;
    }
})();
`;

// Runs inside INNER context (active-frame) — direct DOM access, no proxy needed
const SEARCH_CODE_INNER = `
(function() {
    function scanDoc(doc, label) {
        var out = { label: label, url: window.location.href.substring(0, 80) };

        var runCandidates = doc.querySelectorAll(
            'button.kiro-button[data-variant="primary"][data-purpose="alert"]'
        );
        out.runButtons = Array.from(runCandidates).map(function(b) {
            return { text: b.textContent.trim(), dataActive: b.getAttribute('data-active'), classes: b.className };
        });

        var walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null, false);
        var waitingContainer = null;
        var node;
        while ((node = walker.nextNode())) {
            if (node.nodeValue && node.nodeValue.includes('Waiting on your input')) {
                var el = node.parentElement;
                while (el && el !== doc.body) {
                    if (el.querySelectorAll('button').length >= 1) { waitingContainer = el; break; }
                    el = el.parentElement;
                }
                break;
            }
        }

        if (waitingContainer) {
            out.waitingContainer = {
                tag: waitingContainer.tagName,
                classes: waitingContainer.className.substring(0, 100),
                innerText: waitingContainer.innerText.replace(/\\n/g, ' ').substring(0, 120),
                buttons: Array.from(waitingContainer.querySelectorAll('button')).map(function(b) {
                    return { text: b.textContent.trim(), classes: b.className, dataVariant: b.getAttribute('data-variant') };
                }),
            };
        } else {
            out.waitingContainer = null;
            out.allKiroButtons = Array.from(doc.querySelectorAll('button.kiro-button')).map(function(b) {
                return { text: b.textContent.trim(), classes: b.className };
            });
        }
        return out;
    }
    return JSON.stringify(scanDoc(document, 'inner/active-frame'), null, 2);
})();
`;

const CLICK_CODE = `
(function() {
    // Try from outer context via active-frame first
    function tryClick(doc) {
        var candidates = doc.querySelectorAll(
            'button.kiro-button[data-variant="primary"][data-purpose="alert"]'
        );
        var btn = Array.from(candidates).find(function(b) {
            return b.textContent.trim().indexOf('Run') !== -1;
        });
        if (btn) { btn.click(); return 'CLICKED: ' + btn.textContent.trim(); }
        return null;
    }

    var frame = document.getElementById('active-frame');
    if (frame && frame.contentDocument) {
        var r = tryClick(frame.contentDocument);
        if (r) return r;
    }
    return tryClick(document) || 'NOT FOUND';
})();
`;

async function evalInContext(Runtime, code, ctxId, label) {
    try {
        const result = await Runtime.evaluate({
            expression: code,
            contextId: ctxId,
            returnByValue: true,
        });
        if (result.exceptionDetails) {
            console.error(`[${label}] JS error:`, result.exceptionDetails.exception?.description || result.exceptionDetails.text);
            return null;
        }
        return result.result?.value;
    } catch(e) {
        console.error(`[${label}] eval error:`, e.message);
        return null;
    }
}

async function main() {
    let client;
    try {
        const targets = await CDP.List({ port: PORT });

        // Find kiroAgent iframe (prefer by URL, fall back to TARGET_IDX)
        const kiroTarget = targets.find(t => t.url && t.url.includes('kiroAgent'))
                        || targets[TARGET_IDX];

        if (!kiroTarget) {
            console.error('Kiro webview target not found. Is Kiro running with --remote-debugging-port=9333?');
            process.exit(1);
        }
        console.log(`Target: [${targets.indexOf(kiroTarget)}] ${kiroTarget.type} — ${(kiroTarget.url || '').substring(0, 90)}\n`);

        client = await CDP({ target: kiroTarget.id, port: PORT });
        const { Runtime } = client;

        const contexts = [];
        Runtime.executionContextCreated(p => contexts.push(p.context));
        await Runtime.enable();
        await new Promise(r => setTimeout(r, 1200));

        console.log(`Execution contexts (${contexts.length}):`);
        contexts.forEach(c => console.log(`  ctx[${c.id}] origin=${c.origin}  name="${c.name}"`));
        console.log('');

        // --- Outer context (index.html) → reaches active-frame via contentDocument ---
        const outerCtx = contexts.find(c => c.id === 1) || contexts[0];
        if (outerCtx) {
            console.log(`=== Outer context (ctx ${outerCtx.id}) ===`);
            const raw = await evalInContext(Runtime, SEARCH_CODE, outerCtx.id, 'outer');
            if (raw) console.log(raw);
        }

        // --- Inner context (active-frame) — direct DOM ---
        const innerCtx = contexts.find(c => c.id === 2) || contexts[1];
        if (innerCtx) {
            console.log(`\n=== Inner context (ctx ${innerCtx.id}) ===`);
            const raw = await evalInContext(Runtime, SEARCH_CODE_INNER, innerCtx.id, 'inner');
            if (raw) console.log(raw);
        }

        // --- Optionally click Run ---
        if (SHOULD_CLICK && outerCtx) {
            console.log('\n=== Clicking Run button ===');
            const clickResult = await evalInContext(Runtime, CLICK_CODE, outerCtx.id, 'click');
            console.log('Result:', clickResult);
        }

    } catch(e) {
        console.error('Fatal:', e.message);
    } finally {
        if (client) await client.close();
    }
}

main().catch(console.error);
