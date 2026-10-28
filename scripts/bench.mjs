#!/usr/bin/env node
/**
 * Latency/throughput benchmark for public routes against a production build.
 *
 *   BASE_URL=http://localhost:3123 node scripts/bench.mjs [requests=400] [concurrency=20]
 *
 * Reports requests/second and p50/p95/p99 latency per route. Run on an otherwise
 * idle machine; numbers are only comparable between runs on the same hardware.
 */
const BASE = (process.env.BASE_URL || "http://localhost:3123").replace(/\/$/, "");
const TOTAL = Number(process.argv[2] || 400);
const CONCURRENCY = Number(process.argv[3] || 20);

const ROUTES = ["/", "/pricing", "/login", "/register", "/legal/privacy", "/api/health"];

const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];

async function bench(path) {
  const latencies = [];
  let errors = 0;
  let next = 0;
  // Warm-up so first-render compilation and connection setup are excluded
  for (let i = 0; i < 5; i++) await fetch(BASE + path).then((r) => r.arrayBuffer());

  const started = performance.now();
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < TOTAL) {
        next++;
        const t = performance.now();
        try {
          const res = await fetch(BASE + path, { redirect: "manual" });
          await res.arrayBuffer();
          if (res.status >= 500) errors++;
        } catch {
          errors++;
        }
        latencies.push(performance.now() - t);
      }
    })
  );
  const seconds = (performance.now() - started) / 1000;
  latencies.sort((a, b) => a - b);
  return {
    route: path,
    rps: Math.round(TOTAL / seconds),
    p50: pct(latencies, 50).toFixed(1),
    p95: pct(latencies, 95).toFixed(1),
    p99: pct(latencies, 99).toFixed(1),
    errors,
  };
}

const rows = [];
for (const route of ROUTES) rows.push(await bench(route));

console.log(`${TOTAL} requests per route, concurrency ${CONCURRENCY}, ${BASE}\n`);
console.log("route            req/s   p50 ms   p95 ms   p99 ms   5xx");
for (const r of rows) {
  console.log(
    `${r.route.padEnd(16)} ${String(r.rps).padStart(5)}  ${r.p50.padStart(7)}  ${r.p95.padStart(7)}  ${r.p99.padStart(7)}  ${String(r.errors).padStart(4)}`
  );
}
