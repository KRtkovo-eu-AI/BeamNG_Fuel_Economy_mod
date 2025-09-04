const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { run } = require('node:test');

const testsDir = path.join(__dirname, '..', 'tests');
const testFiles = fs
  .readdirSync(testsDir)
  .filter((f) => f.endsWith('.test.js'))
  .map((f) => path.join('tests', f));

const major = parseInt(process.versions.node.split('.')[0], 10);
const argv = process.argv.slice(2);
const reporterArgs = [];
const otherArgs = [];

for (const arg of argv) {
  if (arg.startsWith('--test-reporter')) {
    if (major >= 20) {
      reporterArgs.push(arg);
    }
  } else {
    otherArgs.push(arg);
  }
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

if (major >= 20) {
  const child = spawn(
    process.execPath,
    ['--test', ...reporterArgs, ...otherArgs, ...testFiles],
    {
      env: { ...process.env, NODE_OPTIONS: '' },
      stdio: 'inherit'
    }
  );

  child.on('close', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
    } else {
      process.exit(code);
    }
  });
} else {
  (async () => {
    const cases = [];
    let failures = 0;
    const start = Date.now();
    for await (const { type, data } of run({ files: testFiles })) {
      if (data.details?.type !== 'test') continue;
      if (type === 'test:pass') {
        const t = (data.details?.duration_ms || 0) / 1000;
        console.log(`\u2713 ${data.name}`);
        cases.push(
          `<testcase name="${escapeXml(data.name)}" time="${t}"></testcase>`
        );
      } else if (type === 'test:fail') {
        const t = (data.details?.duration_ms || 0) / 1000;
        const msg =
          data.details?.error?.message ||
          data.errors?.[0]?.message ||
          'failed';
        console.log(`\u2717 ${data.name}`);
        if (data.details?.error) console.error(data.details.error);
        if (data.errors)
          data.errors.forEach((e) => console.error(e));
        cases.push(
          `<testcase name="${escapeXml(
            data.name
          )}" time="${t}"><failure>${escapeXml(msg)}</failure></testcase>`
        );
        failures++;
      }
    }
    const total = cases.length;
    const time = (Date.now() - start) / 1000;
    const suite = `<?xml version="1.0" encoding="utf-8"?>\n<testsuite name="node" tests="${total}" failures="${failures}" errors="0" skipped="0" time="${time}">\n${cases.join(
      '\n'
    )}\n</testsuite>\n`;
    fs.writeFileSync('test-results.xml', suite);
    process.exit(failures > 0 ? 1 : 0);
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
