// Start / keep-alive helpers shared by ApiContainer and PoolContainer.

// Cloudflare stops a container this long after its Durable Object goes idle (max 6 h).
const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000;
// The keep-alive alarm wakes the Durable Object this often while its container runs, so it never goes idle.
const KEEP_ALIVE_INTERVAL_MS = 60 * 1000;

const LISTEN_RETRY_DELAY_MS = 500;

export const getContainer = (ctx: DurableObjectState): Container => {
  if (!ctx.container) {
    throw new Error('no container is configured for this Durable Object');
  }
  return ctx.container;
};

/** Starts the container (no-op if it already runs) and arms the keep-alive alarm. */
export const startContainer = async (ctx: DurableObjectState, containerEnv: Record<string, string>, label: string) => {
  const container = getContainer(ctx);
  if (container.running) {
    return;
  }
  container.start({ env: containerEnv, enableInternet: true });
  console.log(`${label}: container started`);
  ctx.waitUntil(
    container
      .monitor()
      .then(() => console.log(`${label}: container exited`))
      .catch((err) => console.log(`${label}: container stopped with error`, err)),
  );
  await keepAlive(ctx);
};

/**
 * Renews the inactivity timeout and schedules the next alarm. Call it from alarm() while the container runs.
 * A restarted Durable Object has no timeout set, so the constructor calls it too.
 */
export const keepAlive = async (ctx: DurableObjectState) => {
  await getContainer(ctx).setInactivityTimeout(INACTIVITY_TIMEOUT_MS);
  await ctx.storage.setAlarm(Date.now() + KEEP_ALIVE_INTERVAL_MS);
};

/** `running` turns true before the process listens; wait until the port answers any HTTP request. */
export const waitUntilListening = async (container: Container, port: number, timeoutMs: number) => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      await container.getTcpPort(port).fetch('http://container/');
      return;
    } catch (err) {
      if (Date.now() > deadline) {
        throw new Error(`container did not listen on port ${port} within ${timeoutMs}ms: ${err}`);
      }
      await new Promise((resolve) => setTimeout(resolve, LISTEN_RETRY_DELAY_MS));
    }
  }
};
