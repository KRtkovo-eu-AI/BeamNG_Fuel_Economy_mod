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
    assert.ok(styleTrue.includes('background-image:linear-gradient'));
    assert.ok(!styleTrue.includes("url('app.png')"));
  });

  it('positions reset, style toggle and settings icons consistently', () => {
    const resetAttr = getNgAttrStyle('ng-click="reset($event)"');
    const toggleAttr = getNgAttrStyle('ng-click="useCustomStyles=!useCustomStyles"');
    const settingsAttr = getNgAttrStyle('ng-click="settingsOpen=!settingsOpen"');
    const r = parseStyle(resetAttr);
    const t = parseStyle(toggleAttr);
    const s = parseStyle(settingsAttr);

    assert.ok(r.base.includes('position:absolute; top:2px; right:4px;'));
    assert.ok(t.base.includes('position:absolute; top:24px; right:4px;'));
    assert.ok(s.base.includes('position:absolute; top:46px; right:4px;'));
    [r, t, s].forEach(obj => {
      assert.ok(obj.base.includes('cursor:pointer;'));
      assert.ok(obj.base.includes('font-size:18px;'));
      assert.ok(obj.custom.includes('color:#5fdcff;'));
    });
  });

  it('preserves neon background and typography when custom styles are enabled', () => {
    assert.ok(html.includes('background-image:linear-gradient'));
    assert.ok(html.includes('border-radius:10px;'));
    assert.ok(html.includes('color:#aeeaff;'));
    assert.ok(html.includes('font-family: Segoe UI, Tahoma, Geneva, Verdana, sans-serif;'));
    assert.ok(!html.includes('font-family:"'));
    assert.ok(html.includes('box-shadow: inset 0 0 10px rgba(0,200,255,0.25);'));
  });

  it('provides all data placeholders and icons', () => {
    const placeholders = ['data1','fuelUsed','fuelLeft','fuelCap','data3','data4','instantLph','instantL100km','data6','data7','data8','data9'];
    placeholders.forEach(p => {
      assert.ok(html.includes(`{{ ${p} }}`), `missing ${p}`);
    });
    assert.ok(html.includes('{{ vehicleNameStr }}'));
    assert.ok(html.includes('strong ng-if="visible.heading"'));
    assert.ok(html.includes('ng-click="reset($event)"'));
    assert.ok(html.includes('ng-click="useCustomStyles=!useCustomStyles"'));
    assert.ok(html.includes('ng-click="settingsOpen=!settingsOpen"'));
    assert.ok(html.includes('autorenew'));
    assert.ok(html.includes('palette'));
    assert.ok(html.includes('settings'));
    assert.ok(html.includes('<span class="material-icons"')); 
    assert.ok(html.includes('save</span>'));
  });

  it('allows toggling visibility of heading and subfields', () => {
    assert.ok(html.includes('ng-if="visible.distanceMeasured || visible.distanceEcu"'));
    assert.ok(html.includes('ng-if="visible.fuelUsed || visible.fuelLeft || visible.fuelCap"'));
    assert.ok(html.includes('ng-if="visible.instantLph || visible.instantL100km"'));
    const toggles = ['visible.heading','visible.distanceMeasured','visible.distanceEcu','visible.fuelUsed','visible.fuelLeft','visible.fuelCap','visible.instantLph','visible.instantL100km'];
    toggles.forEach(t => {
      assert.ok(html.includes(`ng-model="${t}"`), `missing toggle ${t}`);
    });
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
    streams.engineInfo[12] = 60;

    $scope.on_streamsUpdate(null, streams);

    const fields = ['data1','fuelUsed','fuelLeft','fuelCap','data3','data4','instantLph','instantL100km','data6','data7','data8','data9'];
    fields.forEach(f => {
      assert.notStrictEqual($scope[f], '', `${f} empty`);
    });
  });

  it('throttles instant consumption updates', () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    global.bngApi = { engineLua: () => '' };
    const store = {};
    global.localStorage = { getItem: () => null, setItem: () => {} };
    let now = 0;
    global.performance = { now: () => now };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[2];
    const $scope = { $on: (name, cb) => { $scope['on_' + name] = cb; }, $evalAsync: fn => fn() };
    controllerFn({ debug: () => {} }, $scope);

    const streams = { engineInfo: Array(15).fill(0), electrics: { wheelspeed: 10, trip: 5, throttle_input: 0 } };
    streams.engineInfo[11] = 50;
    streams.engineInfo[12] = 60;

    now = 0;
    $scope.on_streamsUpdate(null, streams);
    const first = $scope.instantLph;

    now = 100;
    $scope.on_streamsUpdate(null, streams);
    assert.equal($scope.instantLph, first);

    now = 300;
    $scope.on_streamsUpdate(null, streams);
    assert.notStrictEqual($scope.instantLph, first);
  });
});

describe('visibility settings persistence', () => {
  it('saves and restores user choices', () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    global.bngApi = { engineLua: () => '' };
    const store = {};
    global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k,v) => { store[k] = v; } };
    global.performance = { now: () => 0 };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[2];

    const $scope = { $on: () => {} };
    controllerFn({ debug: () => {} }, $scope);

    assert.equal($scope.visible.heading, true);
    $scope.visible.heading = false;
    $scope.visible.fuelLeft = false;
    $scope.visible.instantLph = false;
    $scope.saveSettings();

    assert.ok(store.okFuelEconomyVisible.includes('"heading":false'));
    assert.ok(store.okFuelEconomyVisible.includes('"fuelLeft":false'));
    assert.ok(store.okFuelEconomyVisible.includes('"instantLph":false'));

    const $scope2 = { $on: () => {} };
    controllerFn({ debug: () => {} }, $scope2);
    assert.equal($scope2.visible.heading, false);
    assert.equal($scope2.visible.fuelLeft, false);
    assert.equal($scope2.visible.instantLph, false);
    assert.equal($scope2.visible.fuelUsed, true);
  });
});
