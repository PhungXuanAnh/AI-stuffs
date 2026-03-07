const CDP = require('chrome-remote-interface');
const fs = require('fs');

const scriptPath = process.argv[2];
const targetIndex = process.argv[3] ? parseInt(process.argv[3]) : null;

if (!scriptPath) {
  console.error('Usage: node inject.js <script-file> [target-index]');
  console.error('  If no target-index, lists all targets.');
  console.error('  If target-index given, injects script into that target.');
  process.exit(1);
}

async function main() {
  let client;
  try {
    const targets = await CDP.List({ port: 9333 });
    console.log('Available targets:');
    targets.forEach((t, i) => {
      const marker = (i === targetIndex) ? ' <-- SELECTED' : '';
      console.log(`  [${i}] ${t.type}: ${t.title || '(no title)'} — ${(t.url || '').substring(0, 100)}${marker}`);
    });

    if (targetIndex === null) {
      console.log('\nRe-run with target index: node inject.js <script-file> <index>');
      return;
    }

    const target = targets[targetIndex];
    if (!target) {
      console.error(`Target index ${targetIndex} not found`);
      process.exit(1);
    }

    const code = fs.readFileSync(scriptPath, 'utf8');
    client = await CDP({ target: target.id, port: 9333 });

    const { Runtime } = client;
    await Runtime.enable();

    console.log(`\nInjecting into: [${targetIndex}] ${target.title || target.url}`);
    const result = await Runtime.evaluate({
      expression: code,
      awaitPromise: true,
      returnByValue: true,
    });

    if (result.exceptionDetails) {
      console.error('Script error:', JSON.stringify(result.exceptionDetails, null, 2));
    } else {
      console.log('Result:', JSON.stringify(result.result?.value, null, 2));
    }
  } finally {
    if (client) await client.close();
  }
}

main().catch(console.error);
