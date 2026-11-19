// CF-0 spike: can a Cloudflare container open outbound TCP / TLS to our Redis, RabbitMQ and MongoDB?
// No npm dependencies on purpose: it tests the network path, not the client libraries.
// GET /check runs every check and returns one JSON report.
const http = require('node:http');
const net = require('node:net');
const tls = require('node:tls');
const dns = require('node:dns/promises');

const PORT = 8080;
const TIMEOUT_MS = 10_000;

/** Opens a TCP (or TLS) socket, optionally sends `payload`, and resolves with the first bytes received. */
function connect({ host, port, useTls, payload }) {
  return new Promise((resolve, reject) => {
    const socket = useTls ? tls.connect({ host, port, servername: host }) : net.connect({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`timeout after ${TIMEOUT_MS}ms`));
    }, TIMEOUT_MS);
    socket.once(useTls ? 'secureConnect' : 'connect', () => {
      if (!payload) {
        clearTimeout(timer);
        socket.end();
        resolve('connected');
        return;
      }
      socket.write(payload);
    });
    socket.once('data', (data) => {
      clearTimeout(timer);
      socket.end();
      resolve(data.toString().trim().slice(0, 200));
    });
    socket.once('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

// Redis: AUTH (when a password is set) + PING. A healthy server answers "+OK" / "+PONG".
async function checkRedis(env) {
  const auth = env.REDIS_PASSWORD
    ? `AUTH ${env.REDIS_USERNAME ? `${env.REDIS_USERNAME} ` : ''}${env.REDIS_PASSWORD}\r\n`
    : '';
  return connect({
    host: env.REDIS_HOST,
    port: Number(env.REDIS_PORT),
    useTls: env.REDIS_TLS === 'true',
    payload: `${auth}PING\r\n`,
  });
}

// RabbitMQ: TLS/TCP handshake to the host in RABBIT_MQ_URL (amqps:// = TLS on 5671, amqp:// = TCP on 5672).
async function checkRabbitMq(env) {
  const url = new URL(env.RABBIT_MQ_URL);
  const useTls = url.protocol === 'amqps:';
  return connect({ host: url.hostname, port: Number(url.port) || (useTls ? 5671 : 5672), useTls });
}

// MongoDB: mongodb+srv:// is resolved through DNS SRV first (Atlas), then a TLS handshake to the first host.
async function checkMongo(env) {
  const url = new URL(env.MONGO_DB_URL);
  if (url.protocol === 'mongodb+srv:') {
    const [record] = await dns.resolveSrv(`_mongodb._tcp.${url.hostname}`);
    return connect({ host: record.name, port: record.port, useTls: true });
  }
  return connect({
    host: url.hostname,
    port: Number(url.port) || 27017,
    useTls: url.searchParams.get('tls') === 'true' || url.searchParams.get('ssl') === 'true',
  });
}

async function runCheck(name, check) {
  const startedAt = Date.now();
  try {
    return { name, ok: true, reply: await check(process.env), ms: Date.now() - startedAt };
  } catch (err) {
    return { name, ok: false, error: err.message, ms: Date.now() - startedAt };
  }
}

http
  .createServer(async (req, res) => {
    if (req.url !== '/check') {
      res.writeHead(404).end();
      return;
    }
    const results = await Promise.all([
      runCheck('redis', checkRedis),
      runCheck('rabbitmq', checkRabbitMq),
      runCheck('mongodb', checkMongo),
    ]);
    console.log(JSON.stringify(results));
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ results }, null, 2));
  })
  .listen(PORT, () => console.log(`connectivity check listening on :${PORT}`));
