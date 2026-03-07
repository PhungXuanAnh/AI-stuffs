const CDP = require('chrome-remote-interface');

// This script connects to ALL targets and tries to find+click the Kiro Run button
// Usage: node find-run-button.js

const BUTTON_CLICK_CODE = `
(function() {
    var candidates = document.querySelectorAll('button.kiro-button[data-variant="primary"][data-purpose="alert"]');
    var btn = Array.from(candidates).find(function(b) { return b.textContent.trim().indexOf('Run') !== -1; });
    if (btn) { btn.click(); return 'CLICKED: ' + btn.textContent.trim(); }
    
    // Also report what we see
    var info = {
        url: window.location.href.substring(0, 80),
        buttons: document.querySelectorAll('button').length,
        kiroButtons: document.querySelectorAll('button.kiro-button').length,
    };
    return 'NOT_FOUND: ' + JSON.stringify(info);
})();
`;

async function main() {
    try {
        const targets = await CDP.List({ port: 9333 });
        console.log(`Found ${targets.length} targets\n`);

        for (let i = 0; i < targets.length; i++) {
            const t = targets[i];
            console.log(`[${i}] ${t.type}: ${(t.title || '').substring(0, 40)} — ${(t.url || '').substring(0, 80)}`);

            let client;
            try {
                client = await CDP({ target: t.id, port: 9333 });
                const { Runtime } = client;

                // Register handler BEFORE enabling so we catch all context events
                const contexts = [];
                Runtime.executionContextCreated((params) => {
                    contexts.push(params.context);
                });

                await Runtime.enable();

                // Wait a bit for contexts to be reported
                await new Promise(r => setTimeout(r, 1500));

                console.log(`    Execution contexts: ${contexts.length}`);
                for (const ctx of contexts) {
                    try {
                        const result = await Runtime.evaluate({
                            expression: BUTTON_CLICK_CODE,
                            contextId: ctx.id,
                            returnByValue: true,
                        });
                        const val = result.result?.value || 'undefined';
                        const prefix = val.startsWith('CLICKED') ? '  ✅' : '    ';
                        console.log(`${prefix} ctx[${ctx.id}] ${ctx.origin}: ${val}`);
                        if (val.startsWith('CLICKED')) {
                            console.log('\n🎉 Button found and clicked!');
                            await client.close();
                            return;
                        }
                    } catch (e) {
                        console.log(`      ctx[${ctx.id}]: error - ${e.message.substring(0, 60)}`);
                    }
                }
            } catch (e) {
                console.log(`    Connection error: ${e.message.substring(0, 60)}`);
            } finally {
                if (client) await client.close();
            }
            console.log('');
        }
        console.log('Button not found in any target/context.');
    } catch (e) {
        console.error('Failed to connect to CDP:', e.message);
        console.error('Make sure Kiro is running with: kiro --remote-debugging-port=9333');
    }
}

main();
