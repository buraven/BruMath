import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const bddDirectory = join(process.cwd(), "docs", "bdd");
const coveragePath = join(bddDirectory, "COVERAGE.md");
const validStatuses = new Set(["COVERED", "PARTIAL", "MISSING", "MANUAL"]);
const featureFiles = (await readdir(bddDirectory)).filter((file) =>
  file.endsWith(".feature"),
);
const scenarioIds = new Set();

for (const file of featureFiles) {
  const contents = await readFile(join(bddDirectory, file), "utf8");
  for (const match of contents.matchAll(/\b([A-Z]+-\d{3})\b/g)) {
    if (scenarioIds.has(match[1])) {
      throw new Error(`Identificador BDD duplicado: ${match[1]}.`);
    }
    scenarioIds.add(match[1]);
  }
}

const coverage = await readFile(coveragePath, "utf8");
const coverageRows = [
  ...coverage.matchAll(
    /^\| +([A-Z]+-\d{3}) +\|.*\| +(COVERED|PARTIAL|MISSING|MANUAL) +\|$/gm,
  ),
];
const coverageIds = new Set();

for (const [, id, status] of coverageRows) {
  if (!validStatuses.has(status)) {
    throw new Error(`Status BDD inválido para ${id}: ${status}.`);
  }
  if (coverageIds.has(id)) {
    throw new Error(`Cenário duplicado na matriz: ${id}.`);
  }
  coverageIds.add(id);
}

const undocumented = [...scenarioIds].filter((id) => !coverageIds.has(id));
const unknown = [...coverageIds].filter((id) => !scenarioIds.has(id));

if (undocumented.length || unknown.length) {
  throw new Error(
    [
      undocumented.length && `Sem cobertura: ${undocumented.join(", ")}.`,
      unknown.length && `Sem cenário BDD: ${unknown.join(", ")}.`,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

console.log(`BDD válido: ${scenarioIds.size} cenários e matriz sincronizada.`);
