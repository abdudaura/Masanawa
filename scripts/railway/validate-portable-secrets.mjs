import { readFile } from "node:fs/promises";

const manifest = JSON.parse(
  await readFile(new URL("../../infra/portable/secrets.manifest.json", import.meta.url), "utf8"),
);
const missing = manifest.providerIndependentSecrets.filter(
  (key) => !process.env[key]?.trim(),
);
if (!process.env.RAILWAY_TOKEN?.trim()) missing.unshift("RAILWAY_TOKEN");
if (missing.length) {
  process.stderr.write(
    `Missing required GitHub production secrets: ${missing.join(", ")}\n`,
  );
  process.exit(1);
}
process.stdout.write("Portable secret contract is complete.\n");
