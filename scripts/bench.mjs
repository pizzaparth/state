#!/usr/bin/env node
/**
 * Latency/throughput benchmark against a production build.
 *
 *   BASE_URL=http://localhost:3123 node scripts/bench.mjs [requests=400] [concurrency=20]
 *
 * With BENCH_EMAIL and BENCH_PASSWORD (a seeded demo account on a *test* database) it also
 * benchmarks the signed-in product pages and the latency of a write (Inbox capture, which
 * creates real tasks, so never point it at production).
 *
 * Reports requests/second and p50/p95/p99 latency per route. Run on an otherwise
 * idle machine; numbers are only comparable between runs on the same hardware.
 */
const BASE = (process.env.BASE_URL || "http://localhost:3123").replace(/\/$/, "");
const TOTAL = Number(process.argv[2] || 400);
const CONCURRENCY = Number(process.argv[3] || 20);

const ROUTES = ["/home", "/pricing", "/login", "/register", "/legal/privacy", "/api/health"];

const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];

let cookie = "";

async function bench(path) {
  const latencies = [];
  let errors = 0;
  let next = 0;
  // Warm-up so first-render compilation and connection setup are excluded
  const headers = cookie ? { cookie } : {};
  for (let i = 0; i < 5; i++) await fetch(BASE + path, { headers }).then((r) => r.arrayBuffer());

  const started = performance.now();
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < TOTAL) {
        next++;
        const t = performance.now();
        try {
          const res = await fetch(BASE + path, { redirect: "manual", headers });
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

let writes = null;
if (process.env.BENCH_EMAIL && process.env.BENCH_PASSWORD) {
  const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ email: process.env.BENCH_EMAIL, password: process.env.BENCH_PASSWORD }),
  });
  cookie = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).filter((c) => c.includes("session_token")).join("; ");
  if (!cookie) throw new Error(`Sign-in failed: ${res.status}`);
  for (const route of ["/platform/today", "/platform/personal", "/platform/org/ksan-relay", "/platform/metrics", "/platform/activity", "/platform/inbox"]) rows.push(await bench(route));

  // Write latency: sequential captures through the real Server Action (stays under the
  // 60-per-minute write budget)
  const inbox = await (await fetch(`${BASE}/platform/inbox`, { headers: { cookie } })).text();
  let actionId = null;
  for (const m of inbox.matchAll(/<script[^>]+src="([^"]+\.js)"/g)) {
    const js = await (await fetch(BASE + m[1])).text();
    actionId = js.match(/"([0-9a-f]{40,42})",[^"]{0,120}?"captureTaskAction"/)?.[1] ?? actionId;
  }
  const latencies = [];
  for (let i = 0; i < 40 && actionId; i++) {
    const t = performance.now();
    const r = await fetch(`${BASE}/platform/inbox`, {
      method: "POST",
      headers: { cookie, origin: BASE, "next-action": actionId, "content-type": "text/plain;charset=UTF-8", accept: "text/x-component" },
      body: JSON.stringify([{ text: `Bench capture ${i}` }]),
    });
    const body = await r.text();
    if (!body.includes('"ok":true')) throw new Error(`Capture failed: ${body.slice(0, 200)}`);
    latencies.push(performance.now() - t);
  }
  latencies.sort((a, b) => a - b);
  if (latencies.length) writes = { n: latencies.length, p50: pct(latencies, 50).toFixed(1), p95: pct(latencies, 95).toFixed(1), max: latencies.at(-1).toFixed(1) };
}

console.log(`${TOTAL} requests per route, concurrency ${CONCURRENCY}, ${BASE}\n`);
console.log("route              req/s   p50 ms   p95 ms   p99 ms   5xx");
for (const r of rows) {
  console.log(
    `${r.route.padEnd(18)} ${String(r.rps).padStart(5)}  ${r.p50.padStart(7)}  ${r.p95.padStart(7)}  ${r.p99.padStart(7)}  ${String(r.errors).padStart(4)}`
  );
}
if (writes) console.log(`\nwrite (captureTaskAction round trip, sequential): n=${writes.n}  p50 ${writes.p50} ms  p95 ${writes.p95} ms  max ${writes.max} ms`);
