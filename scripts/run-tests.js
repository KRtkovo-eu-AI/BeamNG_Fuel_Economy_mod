const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const testsDir = path.join(__dirname, '..', 'tests');
const testFiles = fs
  .readdirSync(testsDir)
  .filter((f) => f.endsWith('.test.js'))
  .map((f) => path.join('tests', f));

const major = parseInt(process.versions.node.split('.')[0], 10);
const argv = process.argv.slice(2);
const reporterArgs = [];
const otherArgs = [];
let dest;

for (const arg of argv) {
  if (arg.startsWith('--test-reporter-destination=')) {
    const [, value] = arg.split('=');
    if (value && value !== 'stdout') dest = value;
    if (major >= 20) reporterArgs.push(arg);
  } else if (arg.startsWith('--test-reporter')) {
    if (major >= 20) reporterArgs.push(arg);
  } else {
    otherArgs.push(arg);
  }
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
  const child = spawn(
    process.execPath,
    ['--test', ...otherArgs, ...testFiles],
    {
      env: { ...process.env, NODE_OPTIONS: '' },
      stdio: ['inherit', 'pipe', 'inherit']
    }
  );

  let output = '';
  child.stdout.on('data', (chunk) => {
    output += chunk;
    process.stdout.write(chunk);
  });

  child.on('close', (code, signal) => {
    if (dest) {
      const lines = output.split(/\r?\n/);
      const cases = [];
      for (const line of lines) {
        const m = line.match(/^(not ok|ok)\s+\d+\s+-\s+(.*)/);
        if (m) cases.push({ name: m[2], ok: m[1] === 'ok' });
      }
      const esc = (s) =>
        s
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      const xml = ['<?xml version="1.0" encoding="utf-8"?>'];
      xml.push(
        `<testsuite name="node" tests="${cases.length}" failures="${cases.filter(
          (c) => !c.ok
        ).length}" errors="0" skipped="0" time="0">`
      );
      for (const c of cases) {
        if (c.ok) {
          xml.push(`  <testcase name="${esc(c.name)}"/>`);
        } else {
          xml.push(`  <testcase name="${esc(c.name)}"><failure/></testcase>`);
        }
      }
      xml.push('</testsuite>');
      fs.writeFileSync(dest, xml.join('\n'));
    }
    if (signal) {
      process.kill(process.pid, signal);
    } else {
      process.exit(code);
    }
  });
}
