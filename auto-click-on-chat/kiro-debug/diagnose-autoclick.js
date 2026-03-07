const CDP = require('chrome-remote-interface');

(async () => {
    const targets = await CDP.List({ port: 9333 });
    const kiro = targets.find(t => t.url && t.url.includes('kiroAgent'));
    if (!kiro) { console.log('No kiro target found'); return; }
    console.log('Kiro target found:', kiro.type, kiro.url.substring(0, 80));

    const client = await CDP({ target: kiro.id, port: 9333 });
    const { Runtime } = client;
    const ctxs = [];
    Runtime.executionContextCreated(p => ctxs.push(p.context));
    await Runtime.enable();
    await new Promise(r => setTimeout(r, 1500));

    console.log('\nExecution contexts:', ctxs.length);
    for (const c of ctxs) {
        console.log(`  ctx[${c.id}] origin=${c.origin}`);

        // 1. Check if auto-kiro script is loaded (it sets window.__autoKiroStop)
        const r1 = await Runtime.evaluate({
            expression: '(function(){ return "autoKiroStop=" + typeof window.__autoKiroStop; })()',
            contextId: c.id,
            returnByValue: true,
        });
        console.log(`    ${r1.result.value}`);

        // 2. Check for Run button via active-frame
        const r2 = await Runtime.evaluate({
            expression: `(function(){
                var f = document.getElementById('active-frame');
                if (f) {
                    try {
                        var doc = f.contentDocument;
                        if (doc) {
                            var btns = doc.querySelectorAll('button.kiro-button');
                            return 'active-frame accessible, kiro-buttons: ' + btns.length +
                                   ' texts: [' + Array.from(btns).map(function(b){ return b.textContent.trim(); }).join(', ') + ']';
                        }
                        return 'active-frame found but contentDocument is null';
                    } catch(e) {
                        return 'active-frame found but BLOCKED: ' + e.message;
                    }
                }
                // No active-frame, try direct
                var btns2 = document.querySelectorAll('button.kiro-button');
                return 'no active-frame, direct kiro-buttons: ' + btns2.length +
                       ' texts: [' + Array.from(btns2).map(function(b){ return b.textContent.trim(); }).join(', ') + ']';
            })()`,
            contextId: c.id,
            returnByValue: true,
        });
        console.log(`    ${r2.result.value}`);

        // 3. Check extensionId param to see if the script's guard condition passes
        const r3 = await Runtime.evaluate({
            expression: `(function(){
                var params = new URLSearchParams(window.location.search);
                return 'extensionId=' + params.get('extensionId') + ' url=' + window.location.href.substring(0, 80);
            })()`,
            contextId: c.id,
            returnByValue: true,
        });
        console.log(`    ${r3.result.value}`);
    }
    await client.close();
})().catch(e => console.error(e));
