// lib/concurrency.js
//
// Tiny concurrency-limited map helper — no dependency needed for something
// this small. Used to fetch several Craigslist listing-detail pages (for
// photos) in parallel without firing dozens of simultaneous requests at
// Craigslist, which would be slow to resolve and a good way to get
// rate-limited.

/**
 * @param {Array} items
 * @param {number} limit - max concurrent in-flight calls to fn
 * @param {(item: any, index: number) => Promise<any>} fn
 * @param {object} [opts]
 * @param {number} [opts.jitterMs] - each worker waits a random 0..jitterMs
 *   delay before every call. `limit` simultaneous requests firing in the
 *   same instant is a bursty, obviously-automated traffic pattern — one of
 *   the things anti-bot/rate-limit systems key on. A little jitter spreads
 *   the burst out over real wall-clock time, which costs latency but looks
 *   far less like a scraper hammering the endpoint.
 * @returns {Promise<Array>} results in the same order as `items`; a failed
 *   fn() call resolves to `undefined` at that index rather than rejecting
 *   the whole batch.
 */
async function mapWithConcurrency(items, limit, fn, { jitterMs = 0 } = {}) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      if (jitterMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, Math.random() * jitterMs));
      }
      try {
        results[i] = await fn(items[i], i);
      } catch {
        results[i] = undefined;
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

module.exports = { mapWithConcurrency };
