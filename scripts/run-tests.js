const { spawn } = require('child_process');

const child = spawn(process.execPath, ['--test', 'tests/*.test.js'], {
  env: { ...process.env, NODE_OPTIONS: '' },
  stdio: 'inherit'
});

child.on('close', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code);
  }
});
