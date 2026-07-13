import { copyFile, mkdir } from "node:fs/promises";

const distDataFiles = ["model-rankings.json", "model-support.json"];
const rootDir = new URL("../", import.meta.url);

await mkdir(new URL("dist/", rootDir), { recursive: true });
await Promise.all(
  distDataFiles.map((dataFileName) =>
    copyFile(
      new URL(`data/${dataFileName}`, rootDir),
      new URL(`dist/${dataFileName}`, rootDir),
    ),
  ),
);
