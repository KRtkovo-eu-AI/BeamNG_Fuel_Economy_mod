const assert = require('node:assert');
const { describe, it, afterEach } = require('node:test');
const http = require('http');
const endpoint = require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/localEndpoint.js');

function get(pathname) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: endpoint.PORT, path: pathname }, res => {
      let body = '';
      res.on('data', chunk => (body += chunk));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject);
  });
}

describe('local endpoint server', () => {
  afterEach(async () => {
    await endpoint.stop();
  });

  it('serves html and json data', async () => {
    const state = { value: 1 };
    await endpoint.start(() => state);
    const html = await get('/');
    assert.ok(html.body.includes('<div class="bngApp"'));
    state.value = 2;
    const jsonRes = await get('/data');
    assert.equal(jsonRes.status, 200);
    assert.deepStrictEqual(JSON.parse(jsonRes.body), { value: 2 });
  });
});
