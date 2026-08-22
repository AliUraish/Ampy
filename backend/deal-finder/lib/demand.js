const { execFile } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const BASELINES = Object.freeze({
  bikes: 0.70,
  electronics: 0.80,
  instruments: 0.60,
  jewelry: 0.65,
  furniture: 0.45,
  appliances: 0.50,
  vehicles: 0.65,
  general: 0.50,
});

const cache = new Map();

function cleanString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function baselineFor(category) {
  const key = cleanString(category, 'general').toLowerCase();
  return BASELINES[key] ?? BASELINES.general;
}

function runSidecar(keyword, geo) {
  const projectRoot = path.resolve(__dirname, '..');
  const virtualenvPython = path.join(projectRoot, '.venv', 'bin', 'python');
  const python = fs.existsSync(virtualenvPython) ? virtualenvPython : 'python3';
  const script = path.join(projectRoot, 'demand.py');

  return new Promise((resolve) => {
    let child;
    let guard;
    let settled = false;

    const finish = (value) => {
      if (settled) return;
      settled = true;
      if (guard) clearTimeout(guard);
      resolve(value);
    };

    try {
      child = execFile(
        python,
        [script, keyword, geo],
        {
          timeout: 6000,
          killSignal: 'SIGKILL',
          maxBuffer: 64 * 1024,
          windowsHide: true,
        },
        (error, stdout) => {
          if (error) return finish(null);

          try {
            const result = JSON.parse(stdout.trim());
            const value = result && result.value;
            if (typeof value !== 'number'
              || !Number.isFinite(value)
              || value < 0
              || value > 1) {
              return finish(null);
            }
            return finish(value);
          } catch {
            return finish(null);
          }
        },
      );

      // A second deadline keeps this API bounded even if process cleanup stalls.
      guard = setTimeout(() => {
        try {
          if (child && !child.killed) child.kill('SIGKILL');
        } catch {
          // The process may already have disappeared between the checks.
        }
        finish(null);
      }, 6500);
    } catch {
      finish(null);
    }
  });
}

async function getDemand(input = {}) {
  let keyword = '';
  let fallbackValue = BASELINES.general;

  try {
    const category = cleanString(input && input.category, 'general');
    fallbackValue = baselineFor(category);
    keyword = cleanString(input && input.keyword);
    const geo = cleanString(input && input.geo, 'US-CA') || 'US-CA';
    const fallback = { value: fallbackValue, source: 'baseline', keyword };

    if (!keyword) return fallback;

    const cacheKey = `${keyword.toLowerCase()}\u0000${geo.toUpperCase()}`;
    let pending = cache.get(cacheKey);
    if (!pending) {
      pending = runSidecar(keyword, geo).catch(() => null);
      cache.set(cacheKey, pending);
    }

    const value = await pending;
    if (value === null) {
      // Do not cache category-specific fallbacks under a keyword/geo-only key.
      if (cache.get(cacheKey) === pending) cache.delete(cacheKey);
      return fallback;
    }

    return { value, source: 'trends', keyword };
  } catch {
    return {
      value: fallbackValue,
      source: 'baseline',
      keyword,
    };
  }
}

module.exports = { getDemand };
