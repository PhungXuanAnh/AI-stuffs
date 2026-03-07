const CDP = require('chrome-remote-interface');

// Stream console logs from all Kiro targets.
// Usage:
//   node read-console-logs.js              # all targets
//   node read-console-logs.js 2            # target index 2 only
//   node read-console-logs.js 2 9333       # target index 2, custom port

const PORT        = parseInt(process.argv[3] || '9333', 10);
const targetIndex = process.argv[2] !== undefined ? parseInt(process.argv[2], 10) : null;

// Map CDP type to a short prefix
const TYPE_LABEL = {
    log:     'LOG  ',
    info:    'INFO ',
    warning: 'WARN ',
    error:   'ERR  ',
    debug:   'DEBUG',
    dir:     'DIR  ',
    table:   'TABLE',
};

function formatArgs(args) {
    return args.map(a => {
        if (a.type === 'string')  return a.value;
        if (a.type === 'number')  return String(a.value);
        if (a.type === 'boolean') return String(a.value);
        if (a.type === 'undefined') return 'undefined';
        if (a.type === 'object' && a.value !== undefined) return JSON.stringify(a.value);
        if (a.description)        return a.description;
        return `[${a.type}]`;
    }).join(' ');
}

async function watchTarget(target, idx) {
    const label = `[${idx}:${(target.title || target.type).substring(0, 30)}]`;
    let client;
    try {
        client = await CDP({ target: target.id, port: PORT });
        const { Runtime, Console } = client;

        // Runtime.consoleAPICalled covers console.log/warn/error/etc.
        Runtime.on('consoleAPICalled', ({ type, args, timestamp }) => {
            const ts   = new Date(timestamp * 1000).toISOString().substring(11, 23);
            const lvl  = TYPE_LABEL[type] || type.padEnd(5).substring(0, 5);
            const msg  = formatArgs(args);
            console.log(`${ts} ${lvl} ${label} ${msg}`);
        });

        // Runtime.exceptionThrown catches uncaught JS errors
        Runtime.on('exceptionThrown', ({ exceptionDetails }) => {
            const ts  = new Date().toISOString().substring(11, 23);
            const msg = exceptionDetails.exception?.description
                     || exceptionDetails.text
                     || JSON.stringify(exceptionDetails);
            console.log(`${ts} EXCEP ${label} ${msg.substring(0, 200)}`);
        });

        // Console.messageAdded is the older API — also enable as fallback
        Console.on('messageAdded', ({ message }) => {
            // Deduplicate: Runtime.consoleAPICalled usually fires too,
            // so only log here if source is something Runtime doesn't cover.
            if (message.source !== 'javascript') {
                const rawTs = message.timestamp;
                const tsMs  = rawTs && rawTs > 0 ? rawTs * 1000 : Date.now();
                const ts    = new Date(tsMs).toISOString().substring(11, 23);
                const lvl   = TYPE_LABEL[message.level] || message.level.padEnd(5).substring(0, 5);
                console.log(`${ts} ${lvl} ${label} [${message.source}] ${message.text.substring(0, 200)}`);
            }
        });

        await Runtime.enable();
        await Console.enable();

        console.log(`✅ Watching ${label} (${(target.url || '').substring(0, 90)})`);
    } catch (e) {
        console.error(`❌ Could not connect to target [${idx}]: ${e.message}`);
        if (client) client.close().catch(() => {});
    }
    // Note: we intentionally do NOT close the client — we keep it open to stream events.
    return client;
}

async function main() {
    try {
        const targets = await CDP.List({ port: PORT });
        console.log(`\nFound ${targets.length} targets on port ${PORT}:`);
        targets.forEach((t, i) => {
            const mark = (targetIndex === null || i === targetIndex) ? '  ►' : '   ';
            console.log(`${mark} [${i}] ${t.type.padEnd(14)} ${(t.title || '(no title)').substring(0, 40)}`);
            console.log(`       ${(t.url || '').substring(0, 90)}`);
        });
        console.log('\n--- Streaming console output (Ctrl+C to stop) ---\n');

        const clients = [];
        for (let i = 0; i < targets.length; i++) {
            // Skip DevTools page itself (it's noisy and not useful)
            if (targets[i].url && targets[i].url.startsWith('devtools://')) continue;

            if (targetIndex === null || i === targetIndex) {
                const c = await watchTarget(targets[i], i);
                clients.push(c);
            }
        }

        if (clients.length === 0) {
            console.error('No matching targets found.');
            process.exit(1);
        }

        // Keep process alive; close cleanly on Ctrl+C
        process.on('SIGINT', () => {
            console.log('\nStopping...');
            Promise.all(clients.filter(Boolean).map(c => c.close().catch(() => {})))
                .then(() => process.exit(0));
        });

    } catch (e) {
        console.error('Failed to list CDP targets:', e.message);
        console.error(`Make sure Kiro is running with: kiro --remote-debugging-port=${PORT}`);
        process.exit(1);
    }
}

main().catch(console.error);
