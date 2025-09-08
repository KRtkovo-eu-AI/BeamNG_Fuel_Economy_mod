const http = require('http');
const fs = require('fs');
const path = require('path');

let server;
let getData = () => ({});
let htmlCache;
const PORT = 8099;

function start(dataFn) {
  if (server) return Promise.resolve();
  getData = typeof dataFn === 'function' ? dataFn : getData;
  if (!htmlCache) {
    const htmlPath = path.join(__dirname, 'app.html');
    htmlCache = fs.readFileSync(htmlPath, 'utf8');
  }
  server = http.createServer((req, res) => {
    if (req.url === '/data') {
      res.setHeader('Content-Type', 'application/json');
      try {
        res.end(JSON.stringify(getData()));
      } catch (e) {
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
      console.error('localEndpoint error', err);
      server = null;
      resolve();
    });
    // Bind to all interfaces so both localhost and network clients work.
    server.listen(PORT, resolve);
  });
}

function stop() {
  if (!server) return Promise.resolve();
  return new Promise(resolve => {
    server.close(() => {
      server = null;
      resolve();
    });
  });
}

module.exports = { start, stop, PORT };
