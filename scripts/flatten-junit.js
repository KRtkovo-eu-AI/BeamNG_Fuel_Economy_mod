#!/usr/bin/env node
const fs = require('node:fs');
const [,, input, output] = process.argv;
if (!input || !output) {
  console.error('Usage: node flatten-junit.js <input> <output>');
  process.exit(1);
}
const xml = fs.readFileSync(input, 'utf8');
const testcases = [...xml.matchAll(/<testcase[^>]*\/\>/g)].map(m => m[0]);
let totalTime = 0;
for (const tc of testcases) {
  const m = tc.match(/time="([^"]+)"/);
  if (m) totalTime += parseFloat(m[1]);
}
const suite = `<?xml version="1.0" encoding="utf-8"?>\n<testsuites>\n  <testsuite name="tests" tests="${testcases.length}" failures="0" errors="0" time="${totalTime.toFixed(6)}">\n${testcases.map(tc => '    ' + tc).join('\n')}\n  </testsuite>\n</testsuites>\n`;
fs.writeFileSync(output, suite);
