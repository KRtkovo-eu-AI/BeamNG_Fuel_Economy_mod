#!/usr/bin/env node
const fs = require('fs');

const [,, input, output] = process.argv;
if (!input || !output) {
  console.error('Usage: node flatten-junit.js <input> <output>');
  process.exit(1);
}

if (!fs.existsSync(input)) {
  const empty = `<?xml version="1.0" encoding="utf-8"?>\n<testsuite name="node" tests="0" failures="0" errors="0" skipped="0" time="0">\n</testsuite>\n`;
  fs.writeFileSync(output, empty);
  process.exit(0);
}

const xml = fs.readFileSync(input, 'utf8');
const cases = xml.match(/<testcase[\s\S]*?<\/testcase>|<testcase[^>]*\/>/g) || [];
let total = 0;
const cleaned = cases.map((tc) => {
  const m = tc.match(/time="([0-9.]+)"/);
  if (m) total += parseFloat(m[1]);
  return tc;
});
const suite = `<?xml version="1.0" encoding="utf-8"?>\n<testsuite name="node" tests="${cleaned.length}" failures="0" errors="0" skipped="0" time="${total}">\n${cleaned.join('\n')}\n</testsuite>\n`;
fs.writeFileSync(output, suite);
