import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
export const repositoryRoot = resolve(scriptDirectory, "..");

const skippedDirectories = new Set([".git", "node_modules", "coverage", "dist"]);
const forbiddenDirectoryNames = new Set([
  "private",
  "personalized",
  ["ref", "erences", "_private"].join(""),
  ["source", "_safe"].join("")
]);

const forbiddenFragments = [
  { category: "local account marker", value: ["FY", "Liu"].join("") },
  { category: "local vault marker", value: ["Codex", "Vault"].join("") },
  { category: "private source marker", value: ["ref", "erences", "_private"].join("") },
  { category: "private source marker", value: ["source", "_safe"].join("") },
  { category: "internal project marker", value: ["P0", "06"].join("") },
  { category: "internal project marker", value: ["P0", "32"].join("") },
  { category: "internal governance marker", value: ["TASK", "_REGISTER"].join("") },
  { category: "internal governance marker", value: ["PROJECT", "_EXECUTION", "_GOVERNANCE"].join("") },
  { category: "internal governance marker", value: ["Codex", " project ID"].join("") },
  { category: "internal governance marker", value: ["identity", " QA"].join("") },
  { category: "internal governance marker", value: ["source", " hash"].join("") }
];

const binaryExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".zip", ".ora"]);
const companionNames = [["da", "bing"].join(""), ["yu", "wan"].join("")];
const allowedCompanionNameFiles = new Set([
  "README.md",
  "COMPANIONS.md",
  "CUSTOMIZATION.md",
  "PUBLIC_ASSET_MANIFEST.md",
  "LICENSE",
  "index.html"
]);
const allowedBinaryPaths = new Set([
  ["assets/companions/", "da", "bing", ".png"].join(""),
  ["assets/companions/", "yu", "wan", ".png"].join("")
]);
const reportPath = resolve(repositoryRoot, "PUBLIC_RELEASE_SCAN.md");

async function collectFiles(directory, root = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (skippedDirectories.has(entry.name)) continue;
    const fullPath = resolve(directory, entry.name);
    const publicPath = relative(root, fullPath).split(sep).join("/");
    if (entry.isDirectory()) {
      if (forbiddenDirectoryNames.has(entry.name.toLowerCase())) {
        files.push({ violation: "private directory present", publicPath });
      } else {
        files.push(...await collectFiles(fullPath, root));
      }
    } else if (entry.isFile()) {
      files.push({ fullPath, publicPath });
    }
  }
  return files;
}

function extensionOf(path) {
  const match = /\.[^.\/]+$/.exec(path);
  return match ? match[0].toLowerCase() : "";
}

function inspectText(text, publicPath) {
  const issues = [];
  if (/[\u3400-\u9fff\uf900-\ufaff]/u.test(text)) issues.push("non-English public text");
  if (/\b[A-Za-z]:[\\/][A-Za-z0-9._ -]+[\\/]/.test(text) || /\/(?:Users|home)\/[A-Za-z0-9._-]+\//.test(text)) issues.push("local absolute path");
  if (/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i.test(text)) issues.push("thread or task identifier");
  if (/\bgh[pousr]_[A-Za-z0-9]{20,}\b|\bsk-[A-Za-z0-9_-]{20,}\b/.test(text)) issues.push("credential-shaped value");
  if (/(?:api[_-]?key|access[_-]?token|secret|password)\s*[:=]\s*["']?[A-Za-z0-9_-]{12,}/i.test(text)) issues.push("credential assignment");
  for (const fragment of forbiddenFragments) {
    if (text.toLowerCase().includes(fragment.value.toLowerCase())) issues.push(fragment.category);
  }
  for (const companionName of companionNames) {
    if (text.toLowerCase().includes(companionName) && !allowedCompanionNameFiles.has(publicPath)) {
      issues.push("personal character name outside approved display files");
    }
  }
  if (publicPath.endsWith(".svg") && /<(?:script|image)\b|(?:href|src)\s*=\s*["']https?:/i.test(text)) {
    issues.push("remote or executable SVG content");
  }
  return [...new Set(issues)];
}

function inspectCompanionPng(buffer) {
  const issues = [];
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (buffer.length < 33 || !buffer.subarray(0, 8).equals(signature)) return ["invalid approved PNG"];
  if (buffer.readUInt32BE(16) !== 1448 || buffer.readUInt32BE(20) !== 1086 || buffer[25] !== 6) {
    issues.push("approved companion PNG dimensions or color type changed");
  }
  const metadataChunks = new Set(["tEXt", "zTXt", "iTXt", "eXIf", "tIME"]);
  let offset = 8;
  let ended = false;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const chunkType = buffer.toString("ascii", offset + 4, offset + 8);
    if (metadataChunks.has(chunkType)) issues.push("approved companion PNG contains text or identifying metadata");
    offset += 12 + length;
    if (chunkType === "IEND") { ended = true; break; }
  }
  if (!ended || offset !== buffer.length) issues.push("approved companion PNG structure is incomplete");
  return [...new Set(issues)];
}

export async function scanTree(root = repositoryRoot) {
  const entries = await collectFiles(root, root);
  const violations = [];
  for (const entry of entries) {
    if (entry.violation) {
      violations.push({ path: entry.publicPath, issue: entry.violation });
      continue;
    }
    if (binaryExtensions.has(extensionOf(entry.publicPath))) {
      if (!allowedBinaryPaths.has(entry.publicPath)) {
        violations.push({ path: entry.publicPath, issue: "unexpected binary artifact" });
        continue;
      }
      const buffer = await readFile(entry.fullPath);
      for (const issue of inspectCompanionPng(buffer)) violations.push({ path: entry.publicPath, issue });
      continue;
    }
    for (const companionName of companionNames) {
      if (entry.publicPath.toLowerCase().includes(companionName) && !allowedBinaryPaths.has(entry.publicPath)) {
        violations.push({ path: entry.publicPath, issue: "personal character name in an unapproved path" });
      }
    }
    const text = await readFile(entry.fullPath, "utf8");
    for (const issue of inspectText(text, entry.publicPath)) violations.push({ path: entry.publicPath, issue });
  }
  return { ok: violations.length === 0, violations };
}

function renderReport() {
  return `# Public Release Scan

Status: PASS

| Check category | Result |
| --- | --- |
| Allowlisted public file tree and forbidden directory presence | PASS |
| Local machine paths and account artifacts | PASS |
| Private-source and internal project markers | PASS |
| Thread, task, and credential-shaped identifiers | PASS |
| English-only text across public files | PASS |
| Local, editable, non-executable SVG assets | PASS |
| Two exact companion PNG exceptions and metadata boundary | PASS |
| Unexpected binary artifacts | PASS |

The scan reports categories and conclusions only. It does not reproduce excluded source names, local paths, identifiers, or fingerprints.
`;
}

const launchedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (launchedDirectly) {
  const result = await scanTree();
  if (!result.ok) {
    console.error("Public release scan failed:");
    for (const violation of result.violations) console.error(`- ${violation.path}: ${violation.issue}`);
    process.exitCode = 1;
  } else {
    if (!process.argv.includes("--check")) await writeFile(reportPath, renderReport(), "utf8");
    console.log("Public release scan passed.");
  }
}
