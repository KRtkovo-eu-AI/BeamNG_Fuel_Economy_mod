const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function findLuaFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(findLuaFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.lua')) {
      files.push(fullPath);
    }
  }
  return files;
}

const repoRoot = path.join(__dirname, '..');
const luaFiles = findLuaFiles(repoRoot);
const luacCmd = ['luac', 'luac5.4', 'luac5.3', 'luac5.2', 'luac5.1'].find((cmd) => {
  const res = spawnSync(cmd, ['-v']);
  return res.status === 0;
});

test('all Lua scripts have valid syntax', (t) => {
  if (!luacCmd) {
    t.skip('luac not installed');
    return;
  }

  for (const file of luaFiles) {
    const res = spawnSync(luacCmd, ['-p', file], { encoding: 'utf8' });
    assert.equal(
      res.status,
      0,
      `${path.relative(repoRoot, file)} has syntax errors:\n${res.stderr}`
    );
  }
});

test('engineLua snippets have valid syntax', (t) => {
  if (!luacCmd) {
    t.skip('luac not installed');
    return;
  }
  global.angular = { module: () => ({ directive: () => ({}) }) };
  const tmp = path.join(__dirname, 'tmp.lua');
  const scripts = [];
  global.bngApi = {
    engineLua(code, cb) {
      scripts.push(code);
      if (typeof cb === 'function') cb('{}');
    }
  };
  delete require.cache[
    require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')
  ];
  const {
    loadFuelEmissionsConfig,
    ensureFuelEmissionType
  } = require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
  loadFuelEmissionsConfig();
  ensureFuelEmissionType('Dummy');
  delete global.bngApi;
  for (const code of scripts) {
    fs.writeFileSync(tmp, code);
    const res = spawnSync(luacCmd, ['-p', tmp], { encoding: 'utf8' });
    assert.equal(res.status, 0, `engineLua snippet has syntax errors:\n${res.stderr}`);
  }
  fs.unlinkSync(tmp);
});

