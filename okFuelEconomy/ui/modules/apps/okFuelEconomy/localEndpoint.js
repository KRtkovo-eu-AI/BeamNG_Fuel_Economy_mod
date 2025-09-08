const http = require('http');
const fs = require('fs');
const path = require('path');

let server;
let getData = () => ({});
let htmlCache;
const PORT = 8099;

function start(dataFn) {
  if (server) {
    console.log('[okFE] endpoint already running on port', PORT);
    return Promise.resolve();
  }
  getData = typeof dataFn === 'function' ? dataFn : getData;
  if (!htmlCache) {
    const htmlPath = path.join(__dirname, 'app.html');
    htmlCache = fs.readFileSync(htmlPath, 'utf8');
  }
  console.log('[okFE] starting endpoint on port', PORT);
  server = http.createServer((req, res) => {
    console.log('[okFE] endpoint request', req.method, req.url);
    if (req.url === '/data') {
      res.setHeader('Content-Type', 'application/json');
      try {
        res.end(JSON.stringify(getData()));
      } catch (e) {
        console.error('[okFE] endpoint JSON error', e);
        res.statusCode = 500;
        res.end('{}');
      }
    } else {
      res.setHeader('Content-Type', 'text/html');
      res.end(htmlCache);
    }
  });
  return new Promise(resolve => {
    server.once('error', err => {
      console.error('[okFE] endpoint error', err);
      server = null;
      resolve();
    });
    // Bind to all interfaces so both localhost and network clients work.
    server.listen(PORT, () => {
      console.log('[okFE] endpoint listening on port', PORT);
      resolve();
    });
  });
}

function stop() {
  if (!server) {
    console.log('[okFE] endpoint already stopped');
    return Promise.resolve();
  }
  console.log('[okFE] stopping endpoint');
  return new Promise(resolve => {
    server.close(() => {
      console.log('[okFE] endpoint stopped');
      server = null;
      resolve();
    });
  });
}

module.exports = { start, stop, PORT };
