// Barreira de rede independente para ensaios de processo filho: pré-carregada
// com `node --import`, ANTES do código sob teste. Qualquer tentativa de fetch,
// DNS, socket TCP, http(s) ou TLS aborta o processo com código 99, mesmo que a
// trava de alvo esteja ausente ou quebrada. Nada sai da máquina.
/* global process */
import { syncBuiltinESMExports } from 'node:module';
import dns from 'node:dns';
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import tls from 'node:tls';

function blocked(what) {
  return () => {
    process.stderr.write(`NETWORK_BARRIER_HIT ${what}\n`);
    process.exit(99);
  };
}

globalThis.fetch = blocked('fetch');
for (const fn of ['lookup', 'resolve', 'resolve4', 'resolve6', 'resolveAny']) dns[fn] = blocked(`dns.${fn}`);
net.connect = net.createConnection = blocked('net.connect');
net.Socket.prototype.connect = blocked('socket.connect');
http.request = http.get = blocked('http.request');
https.request = https.get = blocked('https.request');
tls.connect = blocked('tls.connect');
syncBuiltinESMExports();
