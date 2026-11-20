#!/usr/bin/env node
// Renders the static README images from config.json:
//   assets/header-{dark,light}.svg   animated intro banner
//   assets/stack-{dark,light}.svg    tech-stack card
//
// They only change when you edit config.json, so they are committed to main
// rather than rebuilt by the workflow. Re-run after editing:
//
//   npm run assets

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderHeader } from './lib/header.mjs';
import { renderStack } from './lib/stack.mjs';
import { THEMES } from './lib/theme.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');

async function main() {
  const config = JSON.parse(await readFile(path.join(here, 'config.json'), 'utf8'));
  const outputs = {
    header: (theme) => renderHeader(config.header, theme),
    stack: (theme) => renderStack(config.stack, theme),
  };
  for (const [name, render] of Object.entries(outputs)) {
    for (const theme of Object.values(THEMES)) {
      const file = path.join(root, 'assets', `${name}-${theme.name}.svg`);
      await writeFile(file, render(theme));
      console.log(`Wrote ${path.relative(root, file)}`);
    }
  }
}

main().catch((error) => {
  console.error(`✖ ${error.message}`);
  process.exitCode = 1;
});
