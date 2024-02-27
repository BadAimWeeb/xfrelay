import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

let currentDir = resolve(fileURLToPath(import.meta.url), "..");

writeFileSync(resolve(currentDir, "dist", "manifest.json"), readFileSync(resolve(currentDir, "src", "manifest.json")));
writeFileSync(resolve(currentDir, "dist", "index.html"), readFileSync(resolve(currentDir, "index.html")));
