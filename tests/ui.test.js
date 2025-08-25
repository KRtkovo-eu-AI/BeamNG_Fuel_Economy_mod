const assert = require('node:assert');
const { describe, it } = require('node:test');
const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'okFuelEconomy', 'ui', 'modules', 'apps', 'okFuelEconomy', 'app.html');
const html = fs.readFileSync(htmlPath, 'utf8');

function extractAttr(source, startMarker) {
  const start = source.indexOf(startMarker);
  let i = start + startMarker.length;
  let value = '';
  let inSingle = false;
  while (i < source.length) {
    const ch = source[i];
    if (ch === '\\') {
      value += ch;
      i++;
      if (i < source.length) value += source[i];
    } else if (ch === "'") {
      inSingle = !inSingle;
      value += ch;
    } else if (ch === '"' && !inSingle) {
      break;
    } else {
      value += ch;
    }
    i++;
  }
  return value;
}

function getNgAttrStyle(elementMarker) {
  const elemIdx = html.indexOf(elementMarker);
  const slice = html.slice(elemIdx);
  return extractAttr(slice, 'ng-attr-style="');
}

function parseStyle(expr) {
  const prefix = "{{ '";
  const delim = "' + (useCustomStyles ? '";
  const suffix = "' : '') }}";
  const base = expr.slice(prefix.length, expr.indexOf(delim));
  const custom = expr.slice(expr.indexOf(delim) + delim.length, expr.lastIndexOf(suffix));
  return { base, custom };
}

describe('UI template styling', () => {
  it('toggles custom styling correctly', () => {
    const attr = getNgAttrStyle('<div class="bngApp"');
    const { base, custom } = parseStyle(attr);
    const styleTrue = base + custom;

    assert.ok(base.includes('position:relative;'));
    assert.ok(!base.includes('background-color'));
    assert.ok(styleTrue.includes('background-color:rgba(10,15,20,0.75);'));
    assert.ok(styleTrue.includes("url('app.png')"));
  });

  it('positions reset and style toggle icons consistently', () => {
    const resetAttr = getNgAttrStyle('ng-click="reset($event)"');
    const toggleAttr = getNgAttrStyle('ng-click="useCustomStyles=!useCustomStyles"');
    const r = parseStyle(resetAttr);
    const t = parseStyle(toggleAttr);

    assert.ok(r.base.includes('position:absolute; top:2px; right:4px;'));
    assert.ok(t.base.includes('position:absolute; top:24px; right:4px;'));
    assert.ok(r.base.includes('cursor:pointer;'));
    assert.ok(t.base.includes('cursor:pointer;'));
    assert.ok(r.base.includes('font-size:18px;'));
    assert.ok(t.base.includes('font-size:18px;'));

    assert.ok(r.custom.includes('color:#5fdcff;'));
    assert.ok(t.custom.includes('color:#5fdcff;'));
  });

  it('preserves neon background and typography when custom styles are enabled', () => {
    assert.ok(html.includes('background-image:linear-gradient'));
    assert.ok(html.includes('border-radius:10px;'));
    assert.ok(html.includes('color:#aeeaff;'));
    assert.ok(html.includes('font-family:"Segoe UI", Tahoma, Geneva, Verdana, sans-serif;'));
    assert.ok(html.includes('box-shadow: inset 0 0 10px rgba(0,200,255,0.25);'));
  });

  it('provides all data placeholders and icons', () => {
    for (let i = 1; i <= 9; i++) {
      assert.ok(html.includes(`{{ data${i} }}`), `missing data${i}`);
    }
    assert.ok(html.includes('{{ vehicleNameStr }}'));
    assert.ok(html.includes('ng-click="reset($event)"'));
    assert.ok(html.includes('ng-click="useCustomStyles=!useCustomStyles"'));
    assert.ok(html.includes('autorenew'));
    assert.ok(html.includes('palette'));
  });
});

describe('controller integration', () => {
  it('populates data fields from stream updates', () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: (type, val, prec) => (val.toFixed ? val.toFixed(prec) : String(val)) };
    global.bngApi = { engineLua: () => '' };
    global.localStorage = { getItem: () => null, setItem: () => {} };
    global.performance = { now: (() => { let t = 0; return () => { t += 1000; return t; }; })() };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[2];
    const $scope = {
      $on: (name, cb) => { $scope['on_' + name] = cb; },
      $evalAsync: fn => fn()
    };
    controllerFn({ debug: () => {} }, $scope);

    const streams = {
      engineInfo: Array(15).fill(0),
      electrics: { wheelspeed: 10, trip: 5, throttle_input: 0 }
    };
    streams.engineInfo[11] = 50;

    $scope.on_streamsUpdate(null, streams);

    for (let i = 1; i <= 9; i++) {
      assert.notStrictEqual($scope['data' + i], '', `data${i} empty`);
    }
  });
});
