import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";


function readRepositoryFile(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
}


function jobBlock(workflow, jobName) {
  const marker = `\n  ${jobName}:\n`;
  const start = workflow.indexOf(marker);
  assert.notEqual(start, -1, `missing ${jobName} job`);
  const remainder = workflow.slice(start + marker.length);
  const nextJob = /\n  \S[^\n]*:\n/.exec(remainder);
  const end = nextJob ? start + marker.length + nextJob.index : workflow.length;
  return workflow.slice(start, end);
}


function runBlocks(workflow) {
  return Array.from(
    workflow.matchAll(/\n\s+run:\s+\|\n(?:(?:\s{10,}|\s{8,}).*\n?)+/g),
    (match) => match[0],
  );
}


test("workflow write permissions are limited to the jobs that need them", () => {
  const release = readRepositoryFile(".github/workflows/release.yml");
  const modelSync = readRepositoryFile(".github/workflows/model-catalog-sync.yml");

  assert.match(release, /^permissions:\n  contents: read$/m);
  assert.match(jobBlock(release, "publish-cli"), /^    permissions:\n      contents: write$/m);
  assert.match(jobBlock(release, "release-site"), /^    permissions:\n      contents: write$/m);

  assert.match(modelSync, /^permissions:\n  contents: read$/m);
  assert.match(
    jobBlock(modelSync, "sync"),
    /^    permissions:\n      contents: write\n      pull-requests: write$/m,
  );
});


test("release workflow is dispatched from trusted default-branch control", () => {
  const release = readRepositoryFile(".github/workflows/release.yml");

  assert.doesNotMatch(release, /\n\s+push:\n/);
  assert.match(release, /\n  workflow_dispatch:\n/);
  assert.match(release, /\n      release_tag:\n/);

  for (const block of runBlocks(release)) {
    assert.doesNotMatch(block, /\$\{\{\s*github\.ref_name\s*\}\}/);
  }

  assert.match(jobBlock(release, "validate-release"), /refs\/heads\/\$DEFAULT_BRANCH/);
  assert.match(jobBlock(release, "validate-release"), /Release workflow must be dispatched from the protected default branch/);
  assert.match(jobBlock(release, "validate-release"), /git merge-base --is-ancestor "\$tag_commit" "origin\/\$DEFAULT_BRANCH"/);
  assert.match(release, /persist-credentials: false/);
  assert.match(jobBlock(release, "publish-cli"), /environment:\n      name: npm-release/);
  assert.match(jobBlock(release, "release-site"), /environment:\n      name: site-release/);
  assert.match(release, /\bRELEASE_TAG\b/);
  assert.doesNotMatch(release, /\$\{\{\s*github\.ref_name\s*\}\}/);
  assert.match(release, /--verify-tag/);
});


test("release credentials are not exposed to checked-out tag code", () => {
  const release = readRepositoryFile(".github/workflows/release.yml");

  for (const jobName of ["build-cli", "build-site"]) {
    const job = jobBlock(release, jobName);
    assert.match(job, /^    permissions:\n      contents: read$/m);
    assert.match(job, /uses: actions\/checkout@/);
    assert.match(job, /persist-credentials: false/);
    assert.doesNotMatch(job, /contents: write/);
    assert.doesNotMatch(job, /NPM_TOKEN/);
    assert.doesNotMatch(job, /GH_TOKEN/);
  }

  for (const jobName of ["publish-cli", "release-site"]) {
    const job = jobBlock(release, jobName);
    assert.match(job, /^    permissions:\n      contents: write$/m);
    assert.doesNotMatch(job, /uses: actions\/checkout@/);
  }

  assert.match(jobBlock(release, "publish-cli"), /npm publish cli-package\/\*\.tgz --ignore-scripts/);
});


test("model catalog sync does not expose secrets to manually selected refs", () => {
  const modelSync = readRepositoryFile(".github/workflows/model-catalog-sync.yml");

  assert.doesNotMatch(modelSync, /workflow_dispatch:/);
  assert.match(jobBlock(modelSync, "sync"), /if: github\.event_name == 'schedule'/);
  assert.match(
    modelSync,
    /ref: \$\{\{ github\.event\.repository\.default_branch \}\}/,
  );
});


test("the repository publishes a private vulnerability reporting policy", () => {
  const policy = readRepositoryFile("SECURITY.md");

  assert.match(policy, /security\/advisories\/new/);
  assert.match(policy, /Do not open a public issue/i);
  assert.match(policy, /Supported Versions/);
});
