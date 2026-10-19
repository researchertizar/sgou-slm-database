const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const server = require('../dev_server');

function makeRequest(port, reqPath) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: port,
        path: reqPath,
        method: 'GET'
      },
      res => {
        let body = '';
        res.on('data', chunk => {
          body += chunk;
        });
        res.on('end', () => {
          resolve({ statusCode: res.statusCode, headers: res.headers, body });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

test('Dev Server Security: Sibling directory prefix traversal bypass is rejected', async t => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  t.after(() => {
    server.close();
  });

  // Attempting to traverse to sibling directory that starts with the same prefix
  const res = await makeRequest(port, '/../sgou-database-backup/secret.txt');
  assert.strictEqual(res.statusCode, 403, 'Sibling traversal must return 403 Forbidden');
});

test('Dev Server Security: Dotfile access is rejected with 403 Forbidden', async t => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  t.after(() => {
    server.close();
  });

  const gitignoreRes = await makeRequest(port, '/.gitignore');
  assert.strictEqual(gitignoreRes.statusCode, 403, 'Direct dotfile /.gitignore must return 403 Forbidden');

  const gitConfigRes = await makeRequest(port, '/.git/config');
  assert.strictEqual(gitConfigRes.statusCode, 403, 'Subpath dotfile /.git/config must return 403 Forbidden');

  const envRes = await makeRequest(port, '/.env');
  assert.strictEqual(envRes.statusCode, 403, 'Dotfile /.env must return 403 Forbidden');
});

test('Dev Server Functionality: Legitimate routes and clean URLs serve normally', async t => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  t.after(() => {
    server.close();
  });

  const rootRes = await makeRequest(port, '/');
  assert.strictEqual(rootRes.statusCode, 200, 'Root / must return 200 OK');

  const indexRes = await makeRequest(port, '/index.html');
  assert.strictEqual(indexRes.statusCode, 200, 'index.html must return 200 OK');

  const viewRes = await makeRequest(port, '/view.html');
  assert.strictEqual(viewRes.statusCode, 200, 'view.html must return 200 OK');

  const cleanViewRes = await makeRequest(port, '/view');
  assert.strictEqual(cleanViewRes.statusCode, 200, 'Clean /view must return 200 OK');

  const cleanReaderRes = await makeRequest(port, '/reader');
  assert.strictEqual(cleanReaderRes.statusCode, 200, 'Clean /reader must return 200 OK');
});

