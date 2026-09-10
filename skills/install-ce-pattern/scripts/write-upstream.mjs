#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  main,
  managerCommands,
  parseArguments,
  readConfig,
  report,
} from "./lib.mjs";

export function upstreamDocument(config, options) {
  const library = config.library
    ? `- Library: \`${config.library.dir}/\` (\`${config.library.alias}\`, preset ${config.library.preset}${config.library.style ? `, style ${config.library.style}` : ""})`
    : "- Library: none";
  const consumers =
    (config.consumers ?? []).length > 0
      ? config.consumers
          .map(
            (consumer) =>
              `- Consumer: \`${consumer.dir}/\` (layers ${consumer.layers}${consumer.alias ? `, \`${consumer.alias}\`` : ""})`,
          )
          .join("\n")
      : "- Consumers: none";
  return `# Upstream

Provenance for the vendored CE pattern tooling. Updates follow the kit's \`references/update.md\`
as a three-way merge; this directory is never replaced wholesale.

## Source

- Repository: ${options.source}
- Ref: ${options.ref}
- Commit: ${options.commit}
- Skill: ${options.skill}

## Installed paths

- Tooling: \`${config.tooling}/\`
${library}
${consumers}

## Deviations

none

## Verification

\`\`\`bash
${managerCommands(config.packageManager ?? "npm").run} check:component-layers
\`\`\`
`;
}

export function writeUpstream(argv) {
  const options = parseArguments(argv, {
    values: {
      source: "SterlingJF/ce-pattern-kit",
      ref: null,
      commit: "unknown",
      skill: "install-ce-pattern",
    },
    required: ["ref"],
  });
  const { config } = readConfig(options.root);
  const path = join(options.root, config.tooling, "UPSTREAM.md");
  writeFileSync(path, upstreamDocument(config, options));
  return [`${config.tooling}/UPSTREAM.md`];
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main(() => report(writeUpstream(process.argv.slice(2))));
}
