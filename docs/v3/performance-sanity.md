# Nara v3 performance sanity (V3-115)

Local sanity baseline, not a benchmark. Purpose: detect gross practical
regressions in startup, HTTP dispatch, `nara doctor`, and architecture
discovery. No optimization was made from these numbers; nothing measured
below is practically slow.

Reproduce: `npm run build && npm run perf:sanity`. The command is
deliberately NOT part of `npm test`: shared-runner latency variance would
turn micro-assertions flaky. It fails only on catastrophic tripwires
(startup sample > 60s, HTTP p95 > 5s), not on small variance.

## Environment

```text
date=2026-09-04T00:24:52Z commit=b453c47 node=v22.23.2 os=linux/x64
cpus=12 mem=31GiB ( differentials across machines expected )
```

## Methodology

- Startup: built `node build/server.js` with `:memory:` SQLite, timer from
  spawn until first `200 /health`. 1 warmup + 5 measured samples.
- HTTP transport: 200 sequential local `GET /health` (`/health` is exempt
  from rate limiting, so this measures dispatch, not the limiter).
- HTTP API: 10 sequential local `GET /api/auth/me` (expects `401`;
  `/api/*` is rate-limited, so the sample stays small on purpose).
- Doctor: 3 runs of the real CLI path
  (`ts-node src/cli/index.ts doctor`), wall time per run.
- Discovery: 20 in-process iterations each of `discoverFeatures` and
  `discoverFeatureDependencies` inside one `ts-node` process, so the
  numbers reflect the engine rather than interpreter startup.

## Measurements (2026-09-04, commit b453c47)

```text
startup (built /health)      n=5   min=221.88ms median=224.98ms p95=271.03ms max=271.03ms
http GET /health             n=200 min=1.09ms   median=3.15ms   p95=4.28ms   max=12.43ms
http GET /api/auth/me        n=10  min=3.29ms   median=3.59ms   p95=5.69ms   max=5.69ms
nara doctor (real CLI)       n=3   min=1691.76ms median=1699.78ms p95=1782.04ms max=1782.04ms
feature discovery            n=20  min=0.18ms   median=0.25ms   p95=0.41ms   max=8.65ms
dependency discovery         n=20  min=28.09ms  median=32.59ms  p95=55.78ms  max=67.03ms
```

## Interpretation

- Startup (~225ms to first health) is practically instant; no action.
- Local HTTP dispatch (~3ms median) is boring and healthy; no action.
  These are localhost micro-measurements, not capacity claims.
- `nara doctor` (~1.7s) is dominated by `ts-node` interpreter startup,
  not the architecture engine (feature discovery itself is sub-millisecond,
  dependency discovery ~33ms). Fast enough for a release gate; compiling
  the CLI or caching discovery would add machinery for no practical gain.
- No performance architecture changes made. No native benchmark
  dependencies added.

## Limitations

- Localhost only; says nothing about WAN throughput or concurrent load.
- Small samples; p95 on n=5 is indicative, not statistical.
- Machine-specific; compare runs on the same host, not across hosts.
