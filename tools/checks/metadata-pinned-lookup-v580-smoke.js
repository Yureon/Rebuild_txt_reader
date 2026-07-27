#!/usr/bin/env node
const assert = require('assert');
const net = require('net');
const { createPinnedLookup } = require('../../server/services/metadata-transport-service');

async function main() {
  const lookup = createPinnedLookup({ address:'127.0.0.1', family:4 });

  await new Promise((resolve, reject) => {
    lookup('metadata.test', { all:true }, (error, addresses) => {
      try {
        assert.ifError(error);
        assert.deepStrictEqual(addresses, [{ address:'127.0.0.1', family:4 }]);
        resolve();
      } catch (testError) { reject(testError); }
    });
  });

  await new Promise((resolve, reject) => {
    lookup('metadata.test', {}, (error, address, family) => {
      try {
        assert.ifError(error);
        assert.equal(address, '127.0.0.1');
        assert.equal(family, 4);
        resolve();
      } catch (testError) { reject(testError); }
    });
  });

  const server = net.createServer(socket => socket.end());
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try {
    const port = server.address().port;
    await new Promise((resolve, reject) => {
      const socket = net.connect({
        host:'metadata.test',
        port,
        lookup:createPinnedLookup({ address:'127.0.0.1', family:4 })
      });
      socket.once('connect', () => {
        socket.destroy();
        resolve();
      });
      socket.once('error', reject);
    });
  } finally {
    await new Promise(resolve => server.close(resolve));
  }

  assert.throws(() => createPinnedLookup({ address:'', family:0 }), /pinned DNS result is invalid/);
  console.log(JSON.stringify({ pass:'v580-metadata-pinned-lookup-smoke-pass' }));
}

main().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
