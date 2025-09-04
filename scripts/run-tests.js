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

for (const arg of argv) {
  if (arg.startsWith('--test-reporter')) {
    if (major >= 20) {
      reporterArgs.push(arg);
    }
  } else {
    otherArgs.push(arg);
  }
}

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
