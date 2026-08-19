import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const specimensRoot = join(root, 'specimens');
const failures = [];
let checked = 0;

function walk(directory) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (name === 'specimen.json') validate(path);
  }
}

function validate(path) {
  checked += 1;
  let specimen;
  try { specimen = JSON.parse(readFileSync(path, 'utf8')); }
  catch (error) { failures.push(`${relative(root,path)}: invalid JSON: ${error.message}`); return; }
  for (const key of ['schemaVersion','id','status','process','purpose','design','artifacts','provenance','qualification']) {
    if (!(key in specimen)) failures.push(`${relative(root,path)}: missing ${key}`);
  }
  if (!Array.isArray(specimen.artifacts) || specimen.artifacts.length === 0) failures.push(`${relative(root,path)}: no artifacts`);
  for (const artifact of specimen.artifacts ?? []) {
    const artifactPath = join(dirname(path), artifact.path ?? '');
    if (!existsSync(artifactPath)) { failures.push(`${relative(root,path)}: missing artifact ${artifact.path}`); continue; }
    const bytes = readFileSync(artifactPath);
    const digest = createHash('sha256').update(bytes).digest('hex');
    if (bytes.length !== artifact.bytes) failures.push(`${artifact.path}: expected ${artifact.bytes} bytes, got ${bytes.length}`);
    if (digest !== artifact.sha256) failures.push(`${artifact.path}: SHA-256 mismatch`);
    if (artifact.format === 'STEP' && !bytes.subarray(0,32).toString('utf8').startsWith('ISO-10303-21')) failures.push(`${artifact.path}: not ISO-10303-21`);
  }
}

walk(specimensRoot);
if (checked === 0) failures.push('no specimen.json found');
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`AddiSpec validation passed: ${checked} specimen(s)`);
