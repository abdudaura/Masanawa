import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const roots = ["apps/mobile/lib", "services", "packages", "adapters"];
const forbidden = [
  { label: "Railway public hostname", pattern: /https?:\/\/[^\s"'\`]*\.up\.railway\.app/giu },
  { label: "Render public hostname", pattern: /https?:\/\/[^\s"'\`]*\.onrender\.com/giu },
  { label: "sslip provider hostname", pattern: /https?:\/\/[^\s"'\`]*\.sslip\.io/giu },
  { label: "hard-coded public IPv4 URL", pattern: /https?:\/\/(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?/gu }
];

const extensions = new Set([".ts", ".tsx", ".js", ".mjs", ".dart", ".json"]);
const violations = [];

async function walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(file);
      continue;
    }
    if (!entry.isFile() || !extensions.has(path.extname(entry.name))) continue;
    const source = await readFile(file, "utf8");
    for (const rule of forbidden) {
      for (const match of source.matchAll(rule.pattern)) {
        violations.push({ file, label: rule.label, value: match[0] });
      }
    }
  }
}

for (const root of roots) await walk(root);

if (violations.length) {
  process.stderr.write(
    "Provider portability violations found. Application/runtime code must use stable *.masanawa.com endpoints.\n",
  );
  for (const violation of violations) {
    process.stderr.write(
      `- ${violation.file}: ${violation.label}: ${violation.value}\n`,
    );
  }
  process.exit(1);
}

process.stdout.write("Provider portability check passed.\n");
