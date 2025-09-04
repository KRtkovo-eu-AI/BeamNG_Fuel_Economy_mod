const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const testsDir = path.join(__dirname, '..', 'tests');
const testFiles = fs
  .readdirSync(testsDir)
  .filter((f) => f.endsWith('.test.js'))
  .map((f) => path.join('tests', f));

const child = spawn(
  process.execPath,
  ['--test', ...testFiles, ...process.argv.slice(2)],
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
