// Token Radar's build: a sealed snapshot in, a ranked board and an offline dashboard out.
//
// The contract: /input/snapshot.json is read, everything is written under /output, the repo is
// read-only, and the build runs twice and writes the same bytes both times. The board is built by
// lib/model.ts; the dashboard is copied as written; the screenshots are copied as captured; the
// dossier is built by the vendored board module so it matches the gate's own measure.

import { readFileSync, writeFileSync, mkdirSync, cpSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseSnapshot, buildRadar, boardIssue, dataScript } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

/** The build's one failure: a message the runner can print. */
class BuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BuildError';
  }
}

const here = dirname(fileURLToPath(import.meta.url));

/** The input directory: --input <dir> or /input, when it holds a snapshot. */
function inputDir(): string {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input') {
      if (i + 1 >= args.length) throw new BuildError('--input needs a directory');
      return args[i + 1]!;
    }
  }
  return '/input';
}

/** The output directory: MAKEFUN_OUTPUT_DIR or /output. */
function outputDir(): string {
  const env = process.env.MAKEFUN_OUTPUT_DIR;
  return env !== undefined && env.length > 0 ? env : '/output';
}

/** The dashboard files, sorted, with their sizes: the gate's own limits, checked before the copy. */
function dashboardFiles(dir: string): { path: string; bytes: number }[] {
  if (!existsSync(dir)) throw new BuildError('dashboard/ is missing');
  const found: { path: string; bytes: number }[] = [];
  const walk = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) found.push({ path: p, bytes: statSync(p).size });
    }
  };
  walk(dir);
  return found;
}

/** The screenshots, sorted, at least three: the gate reads them as the dashboard's proof. */
function screenshotFiles(dir: string): string[] {
  if (!existsSync(dir)) throw new BuildError('screenshots/ is missing');
  const files = readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && /\.(png|jpe?g)$/i.test(e.name))
    .map((e) => join(dir, e.name))
    .sort();
  if (files.length < 3) throw new BuildError(`screenshots/ holds ${files.length} image${files.length === 1 ? '' : 's'}; the gate needs at least 3`);
  if (files.length > 4) throw new BuildError(`screenshots/ holds ${files.length} images; the gate takes at most 4`);
  return files;
}

/** The build: read, rank, copy, write, and refuse to leave a half-built output behind. */
function build(): void {
  const input = inputDir();
  const output = outputDir();
  const snapshotPath = join(input, 'snapshot.json');
  if (!existsSync(snapshotPath)) throw new BuildError(`${snapshotPath} is missing`);

  const snapshot = parseSnapshot(readFileSync(snapshotPath, 'utf8'));
  const { board, radar } = buildRadar(snapshot);
  const issue = boardIssue(board, snapshot);
  if (issue !== null) throw new BuildError(`the board is not one the gate will take: ${issue}`);

  const dash = dashboardFiles(join(here, 'dashboard'));
  if (dash.length === 0) throw new BuildError('dashboard/ is empty');
  if (dash.length > 400) throw new BuildError(`dashboard/ holds ${dash.length} files; the gate takes at most 400`);
  const total = dash.reduce((s, f) => s + f.bytes, 0);
  if (total > 4_194_304) throw new BuildError(`dashboard/ totals ${total} bytes; the gate takes at most 4 MiB`);
  if (!dash.some((f) => f.path.endsWith('index.html'))) throw new BuildError('dashboard/ has no index.html');
  if (!dash.some((f) => /\.css$/i.test(f.path))) throw new BuildError('dashboard/ has no CSS file');
  if (!dash.some((f) => /\.js$/i.test(f.path))) throw new BuildError('dashboard/ has no JavaScript file');

  const shots = screenshotFiles(join(here, 'screenshots'));
  for (const s of shots) {
    const bytes = statSync(s).size;
    if (bytes > 524_288) throw new BuildError(`${s} is ${bytes} bytes; the gate takes at most 512 KiB per screenshot`);
  }

  mkdirSync(join(output, 'dashboard'), { recursive: true });
  mkdirSync(join(output, 'screenshots'), { recursive: true });
  cpSync(join(here, 'dashboard'), join(output, 'dashboard'), { recursive: true });
  for (const s of shots) {
    const name = s.split('/').at(-1)!;
    writeFileSync(join(output, 'screenshots', name), readFileSync(s));
  }

  const json = `${JSON.stringify({ rows: board })}\n`;
  writeFileSync(join(output, 'board.json'), json);
  writeFileSync(join(output, 'data.js'), dataScript(radar));
  const dossier = buildDossier(output, {
    text_max_bytes: 65_536,
    screenshots: { max: 4, max_bytes: 524_288 },
    dashboard: { max_files: 400, max_bytes: 4_194_304 },
  });
  writeFileSync(join(output, 'dossier.json'), dossier);
}

try {
  build();
  console.log('Token Radar built.');
} catch (error) {
  console.error(`Token Radar failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
