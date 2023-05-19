import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

let currentDir = resolve(fileURLToPath(import.meta.url), "..");

writeFileSync(resolve(currentDir, "dist", "manifest.json"), readFileSync(resolve(currentDir, "src", "manifest.json")));
