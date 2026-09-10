import { basename, resolve } from "node:path";

import { classifyLayers, type FileReport } from "./component-layers";

const roots = process.argv.length > 2 ? process.argv.slice(2) : ["components"];
const report = classifyLayers({ roots: roots.map((root) => resolve(root)) });
const multi = report.packages.length > 1;

const verdict = (file: FileReport): string =>
  file.refusals.length > 0
    ? "refused"
    : file.advisories.length > 0
      ? "advisory"
      : "ok";

const header = ["file", "layer", "sources", "in t/v", "out t/v", "verdict"];
const rows = [
  multi ? ["package", ...header] : header,
  ...report.packages.flatMap((pkg) =>
    pkg.files.map((file) => {
      const cells = [
        file.path,
        file.layer,
        String(file.sources.length),
        `${file.imported.types}/${file.imported.values}`,
        `${file.exported.types}/${file.exported.values}`,
        verdict(file),
      ];
      return multi ? [basename(pkg.root), ...cells] : cells;
    }),
  ),
];
const widths = rows[0].map((_, column) =>
  Math.max(...rows.map((row) => row[column].length)),
);
for (const row of rows) {
  console.log(
    row.map((cell, column) => cell.padEnd(widths[column])).join("  "),
  );
}

let count = 0;
for (const pkg of report.packages) {
  const label = (path: string): string =>
    multi ? `${basename(pkg.root)}/${path}` : path;
  for (const file of pkg.files) {
    count += 1;
    for (const message of file.refusals)
      console.log(`refused   ${label(file.path)}: ${message}`);
    for (const message of file.advisories)
      console.log(`advisory  ${label(file.path)}: ${message}`);
  }
  for (const message of pkg.advisories) {
    console.log(`advisory  ${basename(pkg.root)}: ${message}`);
  }
}
console.log(
  `${count} files, ${report.refusals} refusals, ${report.advisories} advisories`,
);
process.exit(report.refusals > 0 ? 1 : 0);
