import fs from 'node:fs';

const files = process.argv.slice(2);
let total = 0;
let failed = 0;
let skipped = 0;

for (const file of files) {
  const xml = fs.readFileSync(file, 'utf8');
  const cases = [...xml.matchAll(/<testcase\b[^>]*>/g)].length;
  const failures = [...xml.matchAll(/<failure\b[^>]*>/g)].length;
  const errors = [...xml.matchAll(/<error\b[^>]*>/g)].length;
  const skips = [...xml.matchAll(/<skipped\b[^>]*>/g)].length;
  total += cases;
  failed += failures + errors;
  skipped += skips;
}

const passed = total - failed - skipped;
const color = failed > 0 ? 'red' : 'brightgreen';
let message = `${passed} passed`;
if (failed > 0 || skipped > 0) {
  message += `, ${failed} failed`;
  if (skipped > 0) {
    message += `, ${skipped} skipped`;
  }
}

const badge = { schemaVersion: 1, label: 'tests', message, color };
fs.writeFileSync('tests-badge.json', JSON.stringify(badge));
