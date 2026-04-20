import fs from "node:fs";

const summaryPath = "coverage/coverage-summary.json";

if (!fs.existsSync(summaryPath)) {
  process.exit(0);
}

type CoverageMetric = {
  pct: number;
};

type CoverageSummary = {
  total: {
    lines: CoverageMetric;
    branches: CoverageMetric;
    functions: CoverageMetric;
    statements: CoverageMetric;
  };
};

const summary = (JSON.parse(fs.readFileSync(summaryPath, "utf8")) as CoverageSummary).total;
const formatPercent = (value: number): string => `${Number(value).toFixed(2)}%`;

const lines = [
  "## Coverage",
  "",
  `- Lines: ${formatPercent(summary.lines.pct)}`,
  `- Branches: ${formatPercent(summary.branches.pct)}`,
  `- Functions: ${formatPercent(summary.functions.pct)}`,
  `- Statements: ${formatPercent(summary.statements.pct)}`
];

const rendered = `${lines.join("\n")}\n`;

if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, rendered);
} else {
  process.stdout.write(rendered);
}
