import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const distDataFiles = ["model-rankings.json", "model-support.json"];

test("copy-dist-data mirrors published data files", async () => {
  await import(`../scripts/copy-dist-data.mjs?coverage=${Date.now()}`);

  await Promise.all(
    distDataFiles.map(async (dataFileName) => {
      const sourceData = await readFile(`data/${dataFileName}`, "utf8");
      const distData = await readFile(`dist/${dataFileName}`, "utf8");

      assert.equal(distData, sourceData);
    }),
  );
});

test("copy-dist-data works outside the repo cwd", async () => {
  const originalCwd = process.cwd();
  const otherCwd = await mkdtemp(join(tmpdir(), "copy-dist-data-"));

  try {
    process.chdir(otherCwd);
    await import(`../scripts/copy-dist-data.mjs?cwd=${Date.now()}`);
  } finally {
    process.chdir(originalCwd);
    await rm(otherCwd, { recursive: true, force: true });
  }
});
