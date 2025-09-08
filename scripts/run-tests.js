const fs = require('fs');
const path = require('path');
const { run } = require('node:test');

const testsDir = path.join(__dirname, '..', 'tests');
const testFiles = fs
  .readdirSync(testsDir)
  .filter((f) => f.endsWith('.test.js'))
  .map((f) => path.join('tests', f));

const argv = process.argv.slice(2);
const reporters = [];
const destinations = [];

for (const arg of argv) {
  if (arg.startsWith('--test-reporter=')) {
    reporters.push(arg.split('=')[1]);
  } else if (arg.startsWith('--test-reporter-destination=')) {
    destinations.push(arg.split('=')[1]);
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

(async () => {
  const reporterDest = {};
  for (let i = 0; i < reporters.length; i++) {
    reporterDest[reporters[i]] = destinations[i];
  }
  const junitDest = reporterDest['junit'] || 'test-results.xml';

  const cases = [];
  let failures = 0;
  const start = Date.now();
  for await (const event of run({ files: testFiles })) {
    const { type } = event;
    if (type !== 'test:pass' && type !== 'test:fail') continue;

    const obj = event.data || event;
    const evtTest = obj.test;
    const evtDetails = obj.details;
    const evtType = evtDetails?.type || evtTest?.type;
    if (evtType && evtType !== 'test') continue;

    const name = obj.name || evtTest?.name || 'unknown';
    const durationMs = evtDetails?.duration_ms ?? evtTest?.duration_ms ?? 0;
    const t = durationMs / 1000;

    if (type === 'test:pass') {
      console.log(`\u2713 ${name}`);
      cases.push(`<testcase name="${escapeXml(name)}" time="${t}"></testcase>`);
    } else {
      const msg =
        evtDetails?.error?.message || obj.errors?.[0]?.message || 'failed';
      console.log(`\u2717 ${name}`);
      if (evtDetails?.error) console.error(evtDetails.error);
      if (obj.errors) obj.errors.forEach((e) => console.error(e));
      cases.push(
        `<testcase name="${escapeXml(name)}" time="${t}"><failure>${escapeXml(msg)}</failure></testcase>`
      );
      failures++;
    }
  }
  const total = cases.length;
  const time = (Date.now() - start) / 1000;
  const suite = `<?xml version="1.0" encoding="utf-8"?>\n<testsuite name="node" tests="${total}" failures="${failures}" errors="0" skipped="0" time="${time}">\n${cases.join('\n')}\n</testsuite>\n`;
  fs.mkdirSync(path.dirname(junitDest), { recursive: true });
  fs.writeFileSync(junitDest, suite);
  process.exit(failures > 0 ? 1 : 0);
 })().catch((err) => {
  console.error(err);
  process.exit(1);
});

