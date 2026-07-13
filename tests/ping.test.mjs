import assert from "node:assert/strict";
import test from "node:test";

import { destroyAgents, stopPingLoop } from "../dist/lib/ping.js";

test("stopPingLoop clears an active timer and flips the running flag", () => {
  const timer = setTimeout(assert.fail, 60_000, "cleared timer should not fire");
  const ref = { running: true, timer };

  stopPingLoop(ref);

  assert.equal(ref.running, false);
});

test("stopPingLoop accepts missing loop refs", () => {
  assert.doesNotThrow(() => {
    stopPingLoop(null);
    stopPingLoop(undefined);
  });
});

test("destroyAgents is idempotent for empty agent pools", () => {
  assert.doesNotThrow(() => {
    destroyAgents();
    destroyAgents();
  });
});
