import assert from "node:assert/strict";
import test from "node:test";

import {
  B,
  GREEN,
  ORANGE,
  RED,
  WHITE,
  YELLOW,
  applyModelPingResult,
  assertModelMetricsInvariant,
  filterBySearch,
  filterByTier,
  findBestModel,
  getAvg,
  getUptime,
  getVerdict,
  isMetricsCacheEnabled,
  latColor,
  pad,
  readEnv,
  rebuildModelMetrics,
  sortModels,
  splitGraphemes,
  tierColor,
  truncAnsiToWidth,
  uptimeColor,
  visLen,
  visibleWidth,
} from "../dist/lib/utils.js";

function model(overrides = {}) {
  return {
    id: "openrouter/test",
    displayName: "Test Model",
    context: 128000,
    providerKey: "openrouter",
    sweScore: null,
    tier: "A",
    aaBenchmarkScore: null,
    aaBenchmarkName: null,
    aaCodingIndex: null,
    aaIntelligence: null,
    aaSpeedTps: null,
    opencodeSupported: null,
    opencodeCompatibilityReason: null,
    pings: [],
    status: "pending",
    httpCode: null,
    ...overrides,
  };
}

test("environment lookup supports primary, legacy, and missing names", () => {
  const originalPrimary = process.env.FREE_ROUTER_TEST_KEY;
  const originalLegacy = process.env.FROUTER_TEST_KEY;
  delete process.env.FREE_ROUTER_TEST_KEY;
  process.env.FROUTER_TEST_KEY = "legacy";

  assert.equal(readEnv("FREE_ROUTER_TEST_KEY", "FROUTER_TEST_KEY"), "legacy");
  process.env.FREE_ROUTER_TEST_KEY = "primary";
  assert.equal(readEnv("FREE_ROUTER_TEST_KEY", "FROUTER_TEST_KEY"), "primary");
  assert.equal(readEnv("FREE_ROUTER_ABSENT_KEY"), undefined);

  if (originalPrimary === undefined) {
    delete process.env.FREE_ROUTER_TEST_KEY;
  } else {
    process.env.FREE_ROUTER_TEST_KEY = originalPrimary;
  }
  if (originalLegacy === undefined) {
    delete process.env.FROUTER_TEST_KEY;
  } else {
    process.env.FROUTER_TEST_KEY = originalLegacy;
  }
});

test("model ping metrics treat successful and auth-challenged pings as reachable", () => {
  const candidate = model({
    pings: [
      { code: "200", ms: 240 },
      { code: "401", ms: 360 },
      { code: "500", ms: 50 },
    ],
    status: "up",
  });

  assert.equal(getAvg(candidate), 300);
  assert.equal(getUptime(candidate), 67);
  assert.match(getVerdict(candidate), /Perfect/);
});

test("metrics cache can be rebuilt and validates corrupted caches", () => {
  const candidate = model({
    pings: [
      { code: "200", ms: 100 },
      { code: "401", ms: 200 },
      { code: "500", ms: 50 },
    ],
    _metrics: { version: 0, count: -1, okCount: 7, sumOkMs: Number.NaN },
  });

  assert.equal(isMetricsCacheEnabled(), true);
  assert.deepEqual(rebuildModelMetrics(candidate), {
    version: 1,
    count: 3,
    okCount: 2,
    sumOkMs: 300,
  });

  assert.deepEqual(rebuildModelMetrics(model({ pings: undefined })), {
    version: 1,
    count: 0,
    okCount: 0,
    sumOkMs: 0,
  });
  assert.deepEqual(assertModelMetricsInvariant(candidate), { ok: true });

  candidate._metrics.count = 4;
  assert.deepEqual(assertModelMetricsInvariant(candidate), {
    ok: false,
    reason: "count mismatch cache=4 oracle=3",
  });
  candidate._metrics.count = 3;
  candidate._metrics.okCount = 1;
  assert.deepEqual(assertModelMetricsInvariant(candidate), {
    ok: false,
    reason: "okCount mismatch cache=1 oracle=2",
  });
  candidate._metrics.okCount = 2;
  candidate._metrics.sumOkMs = 301;
  assert.deepEqual(assertModelMetricsInvariant(candidate), {
    ok: false,
    reason: "sumOkMs mismatch cache=301 oracle=300",
  });
});

test("metrics cache can be disabled through environment configuration", async () => {
  const originalFlag = process.env.FREE_ROUTER_METRICS_CACHE;
  process.env.FREE_ROUTER_METRICS_CACHE = "0";
  const disabledUtils = await import(`../dist/lib/utils.js?cache-disabled=${Date.now()}`);
  const candidate = model({
    pings: [
      { code: "200", ms: 100 },
      { code: "500", ms: 900 },
    ],
    _metrics: { version: 1, count: 2, okCount: 1, sumOkMs: 100 },
  });

  assert.equal(disabledUtils.isMetricsCacheEnabled(), false);
  assert.equal(disabledUtils.getAvg(candidate), 100);
  assert.equal(disabledUtils.getUptime(candidate), 50);
  assert.equal(disabledUtils.getAvg(model({ pings: [{ code: "500", ms: 900 }] })), Infinity);
  assert.equal(disabledUtils.getUptime(model({ pings: [] })), 0);
  assert.equal(
    disabledUtils.getVerdict(
      model({ status: "degraded", pings: [{ code: "200", ms: 100 }] }),
    ),
    "x Unstable",
  );
  assert.deepEqual(disabledUtils.rebuildModelMetrics(candidate), null);
  assert.equal("_metrics" in candidate, false);
  assert.deepEqual(disabledUtils.assertModelMetricsInvariant(candidate), { ok: true });

  if (originalFlag === undefined) {
    delete process.env.FREE_ROUTER_METRICS_CACHE;
  } else {
    process.env.FREE_ROUTER_METRICS_CACHE = originalFlag;
  }
});

test("model ping metrics update when old pings are evicted", () => {
  const candidate = model({ status: "up" });

  applyModelPingResult(candidate, { code: "200", ms: 900 }, 2);
  applyModelPingResult(candidate, { code: "429", ms: 100 }, 2);
  applyModelPingResult(candidate, { code: "401", ms: 300 }, 2);

  assert.deepEqual(candidate.pings, [
    { code: "429", ms: 100 },
    { code: "401", ms: 300 },
  ]);
  assert.equal(getAvg(candidate), 300);
  assert.equal(getUptime(candidate), 50);
  assert.deepEqual(assertModelMetricsInvariant(candidate), { ok: true });
});

test("model ping metrics tolerate missing ping arrays and empty history", () => {
  const candidate = model({ pings: undefined });

  assert.equal(getAvg(candidate), Infinity);
  assert.equal(getUptime(candidate), 0);
  applyModelPingResult(candidate, { code: "200", ms: 120 }, 5);
  assert.deepEqual(candidate.pings, [{ code: "200", ms: 120 }]);
});

test("model filters match tier and search text without mutating the source list", () => {
  const alpha = model({
    id: "nim/alpha",
    displayName: "Alpha",
    providerKey: "nim",
    tier: "S",
  });
  const beta = model({
    id: "openrouter/beta",
    displayName: "Beta",
    tier: "B",
  });
  const models = [alpha, beta];

  assert.deepEqual(filterByTier(models, "S"), [alpha]);
  assert.deepEqual(filterBySearch(models, "router/beta"), [beta]);
  assert.equal(filterByTier(models, "All"), models);
});

test("model filters and best-model selection handle empty inputs", () => {
  const models = [model({ id: "openrouter/alpha", displayName: "Alpha" })];

  assert.equal(filterByTier(models, "All"), models);
  assert.equal(filterBySearch(models, ""), models);
  assert.deepEqual(filterBySearch([model({ displayName: "" })], "openrouter/test"), [
    model({ displayName: "" }),
  ]);
  assert.deepEqual(filterBySearch(models, "missing"), []);
  assert.equal(findBestModel([]), null);
});

test("model priority prefers reachable high-tier models before faster lower-tier models", () => {
  const alpha = model({
    id: "nim/alpha",
    displayName: "Alpha",
    providerKey: "nim",
    tier: "S",
    pings: [{ code: "200", ms: 500 }],
    status: "up",
  });
  const beta = model({
    id: "openrouter/beta",
    displayName: "Beta",
    providerKey: "openrouter",
    tier: "B",
    pings: [{ code: "200", ms: 250 }],
    status: "up",
  });
  const pending = model({
    id: "openrouter/pending",
    displayName: "Pending",
    tier: "A",
    status: "pending",
  });

  assert.equal(findBestModel([pending, beta, alpha]), alpha);
  assert.deepEqual(sortModels([beta, pending, alpha], "priority").map((m) => m.id), [
    "nim/alpha",
    "openrouter/beta",
    "openrouter/pending",
  ]);
});

test("model sorting supports every exposed column and deterministic fallback", () => {
  const alpha = model({
    id: "nim/alpha",
    displayName: "Alpha",
    providerKey: "nim",
    tier: "S",
    context: 200000,
    aaBenchmarkScore: 81,
    aaIntelligence: 74,
    pings: [{ code: "200", ms: 500 }],
    status: "up",
  });
  const beta = model({
    id: "openrouter/beta",
    displayName: "Beta",
    providerKey: "openrouter",
    tier: "B",
    context: 128000,
    aaBenchmarkScore: null,
    aaIntelligence: null,
    pings: [{ code: "500", ms: 50 }],
    status: "pending",
  });
  const gamma = model({
    id: "openrouter/gamma",
    displayName: "Gamma",
    providerKey: "openrouter",
    tier: "A",
    context: 64000,
    aaBenchmarkScore: 90,
    aaIntelligence: 93,
    pings: [{ code: "200", ms: 100 }],
    status: "up",
  });
  const models = [beta, alpha, gamma];

  assert.deepEqual(sortModels(models, "rank").map((m) => m.id), [
    "openrouter/gamma",
    "nim/alpha",
    "openrouter/beta",
  ]);
  assert.deepEqual(sortModels(models, "tier").map((m) => m.id), [
    "nim/alpha",
    "openrouter/gamma",
    "openrouter/beta",
  ]);
  assert.deepEqual(sortModels(models, "provider").map((m) => m.id), [
    "nim/alpha",
    "openrouter/beta",
    "openrouter/gamma",
  ]);
  assert.deepEqual(sortModels(models, "model", false).map((m) => m.id), [
    "openrouter/gamma",
    "openrouter/beta",
    "nim/alpha",
  ]);
  assert.deepEqual(sortModels(models, "latest").map((m) => m.id), [
    "openrouter/gamma",
    "nim/alpha",
    "openrouter/beta",
  ]);
  assert.deepEqual(sortModels(models, "context").map((m) => m.id), [
    "openrouter/gamma",
    "openrouter/beta",
    "nim/alpha",
  ]);
  assert.deepEqual(sortModels(models, "bench").map((m) => m.id), [
    "openrouter/beta",
    "nim/alpha",
    "openrouter/gamma",
  ]);
  assert.deepEqual(sortModels(models, "intel").map((m) => m.id), [
    "openrouter/beta",
    "nim/alpha",
    "openrouter/gamma",
  ]);
  assert.deepEqual(sortModels(models, "uptime").map((m) => m.id), [
    "openrouter/beta",
    "nim/alpha",
    "openrouter/gamma",
  ]);
  assert.deepEqual(sortModels(models, "verdict").map((m) => m.id), [
    "openrouter/gamma",
    "nim/alpha",
    "openrouter/beta",
  ]);
  assert.deepEqual(sortModels(models, "unknown").map((m) => m.id), [
    "openrouter/gamma",
    "nim/alpha",
    "openrouter/beta",
  ]);

  assert.deepEqual(
    sortModels([
      model({ id: "same", displayName: "Same", pings: [] }),
      model({ id: "same", displayName: "Same", pings: [] }),
    ], "priority").map((m) => m.id),
    ["same", "same"],
  );
  assert.deepEqual(
    sortModels([
      model({ id: "no-tier", tier: "Z" }),
      model({ id: "known-tier", tier: "A" }),
    ], "tier").map((m) => m.id),
    ["known-tier", "no-tier"],
  );
  assert.deepEqual(
    sortModels([
      model({ id: "known-tier", tier: "A" }),
      model({ id: "no-tier", tier: "Z" }),
    ], "tier").map((m) => m.id),
    ["known-tier", "no-tier"],
  );
  assert.deepEqual(
    sortModels([
      model({ id: "fallback-id", displayName: "" }),
      model({ id: "display-name", displayName: "Display" }),
    ], "model").map((m) => m.id),
    ["display-name", "fallback-id"],
  );
  assert.deepEqual(
    sortModels([
      model({ id: "display-name", displayName: "Display" }),
      model({ id: "fallback-id", displayName: "" }),
    ], "model").map((m) => m.id),
    ["display-name", "fallback-id"],
  );
  assert.deepEqual(
    sortModels([
      model({ id: "no-context", context: 0 }),
      model({ id: "with-context", context: 1 }),
    ], "context").map((m) => m.id),
    ["no-context", "with-context"],
  );
  assert.deepEqual(
    sortModels([
      model({ id: "with-context", context: 1 }),
      model({ id: "no-context", context: 0 }),
    ], "context").map((m) => m.id),
    ["no-context", "with-context"],
  );
  assert.deepEqual(
    sortModels([
      model({ id: "no-bench", aaBenchmarkScore: null }),
      model({ id: "with-bench", aaBenchmarkScore: 1 }),
    ], "bench").map((m) => m.id),
    ["no-bench", "with-bench"],
  );
  assert.deepEqual(
    sortModels([
      model({ id: "with-bench", aaBenchmarkScore: 1 }),
      model({ id: "no-bench", aaBenchmarkScore: null }),
    ], "bench").map((m) => m.id),
    ["no-bench", "with-bench"],
  );
  assert.deepEqual(
    sortModels([
      model({ id: "no-intel", aaIntelligence: null }),
      model({ id: "with-intel", aaIntelligence: 1 }),
    ], "intel").map((m) => m.id),
    ["no-intel", "with-intel"],
  );
  assert.deepEqual(
    sortModels([
      model({ id: "with-intel", aaIntelligence: 1 }),
      model({ id: "no-intel", aaIntelligence: null }),
    ], "intel").map((m) => m.id),
    ["no-intel", "with-intel"],
  );
  assert.deepEqual(
    sortModels([
      model({ id: "no-latest", pings: [] }),
      model({ id: "failed-latest", pings: [{ code: "500", ms: 10 }] }),
    ], "latest").map((m) => m.id),
    ["failed-latest", "no-latest"],
  );
  assert.deepEqual(
    sortModels([
      model({ id: "", pings: [] }),
      model({ id: "", pings: [] }),
    ], "avg").map((m) => m.id),
    ["", ""],
  );
  assert.deepEqual(
    sortModels([
      model({ id: "unknown-a", tier: "Z", providerKey: "", displayName: "", pings: [] }),
      model({ id: "unknown-b", tier: "Z", providerKey: "", displayName: "", pings: [] }),
    ], "priority").map((m) => m.id),
    ["unknown-a", "unknown-b"],
  );
  assert.deepEqual(
    sortModels([
      model({ id: "", tier: "Z", providerKey: "", displayName: "", pings: [] }),
      model({ id: "", tier: "Z", providerKey: "", displayName: "", pings: [] }),
    ], "priority").map((m) => m.id),
    ["", ""],
  );
});

test("verdicts cover status and latency boundaries", () => {
  assert.equal(getVerdict(model({ status: "ratelimit", pings: [] })), "x Overloaded");
  assert.equal(getVerdict(model({ pings: [{ code: "429", ms: 1 }] })), "x Overloaded");
  assert.equal(getVerdict(model({ status: "unavailable" })), "x Unavailable");
  assert.equal(getVerdict(model({ status: "forbidden" })), "x Forbidden");
  assert.equal(
    getVerdict(model({ status: "degraded", pings: [{ code: "200", ms: 100 }] })),
    "x Unstable",
  );
  assert.equal(getVerdict(model({ status: "notfound" })), "x Not Found");
  assert.equal(
    getVerdict(model({ status: "down", pings: [{ code: "500", ms: 100 }] })),
    "x Not Active",
  );
  assert.equal(getVerdict(model({ pings: [] })), "- Pending");
  assert.equal(
    getVerdict(model({ status: "up", pings: [{ code: "200", ms: 999 }] })),
    "✓ Normal",
  );
  assert.equal(
    getVerdict(model({ status: "up", pings: [{ code: "200", ms: 2999 }] })),
    "x Slow",
  );
  assert.equal(
    getVerdict(model({ status: "up", pings: [{ code: "200", ms: 4999 }] })),
    "x Very Slow",
  );
  assert.equal(
    getVerdict(model({ status: "up", pings: [{ code: "200", ms: 5000 }] })),
    "x Unusable",
  );
});

test("color helpers encode tier, latency, and uptime thresholds", () => {
  assert.equal(tierColor("S+"), WHITE + B);
  assert.equal(tierColor("A-"), YELLOW);
  assert.equal(tierColor("B+"), ORANGE);
  assert.equal(tierColor("C"), RED);
  assert.equal(latColor(499), GREEN);
  assert.equal(latColor(1499), YELLOW);
  assert.equal(latColor(1500), RED);
  assert.equal(uptimeColor(90), GREEN);
  assert.equal(uptimeColor(70), YELLOW);
  assert.equal(uptimeColor(50), ORANGE);
  assert.equal(uptimeColor(49), RED);
});

test("terminal width truncation preserves ANSI reset while limiting visible text", () => {
  assert.equal(
    truncAnsiToWidth("\x1b[32mfast\x1b[0m model", 4),
    "\x1b[32mfast\x1b[0m",
  );
});

test("terminal width helpers cover ascii, emoji, padding, and fallback segmentation", async () => {
  assert.deepEqual(splitGraphemes(""), []);
  assert.deepEqual(splitGraphemes("ab"), ["a", "b"]);
  assert.equal(visibleWidth(""), 0);
  assert.equal(visibleWidth("abc"), 3);
  assert.equal(visibleWidth("한"), 1);
  assert.equal(visibleWidth("🚀"), 2);
  assert.equal(visLen("\x1b[31mred\x1b[0m"), 3);
  assert.equal(visLen("🚀x"), 3);
  assert.equal(pad("x", 3), "x  ");
  assert.equal(pad("x", 3, true), "  x");
  assert.equal(truncAnsiToWidth("\x1bXwide", 4), "\x1bXwid");
  assert.equal(truncAnsiToWidth("abcdef", 10), "abcdef");

  const originalSegmenter = Object.getOwnPropertyDescriptor(Intl, "Segmenter");
  assert.equal(Reflect.deleteProperty(Intl, "Segmenter"), true);
  try {
    const fallbackUtils = await import(`../dist/lib/utils.js?segmenter-disabled=${Date.now()}`);
    assert.deepEqual(fallbackUtils.splitGraphemes("ab"), ["a", "b"]);
  } finally {
    Object.defineProperty(Intl, "Segmenter", originalSegmenter);
  }
});
