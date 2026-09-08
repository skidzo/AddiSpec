import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDocument as checkDocument } from './lib/contracts.mjs';
import { validateSpatialRecord } from './lib/spatial.mjs';

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function isInside(base, target) {
  return target === base || target.startsWith(`${base}${sep}`);
}

function walkMatching(directory, filename) {
  if (!existsSync(directory)) return [];
  const matches = [];
  for (const name of readdirSync(directory).sort()) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) matches.push(...walkMatching(path, filename));
    else if (name === filename) matches.push(path);
  }
  return matches;
}

function equalArrays(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function findDuplicates(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates].sort();
}

export function validateLibrary(root = defaultRoot) {
  const failures = [];

  function label(path) {
    return relative(root, path);
  }

  function readJson(path) {
    try {
      return JSON.parse(readFileSync(path, 'utf8'));
    } catch (error) {
      failures.push(`${label(path)}: invalid JSON: ${error.message}`);
      return null;
    }
  }

  function validateDocument(path, kind, document) {
    const errors = checkDocument(root, path, kind, document);
    failures.push(...errors.map(error => label(path) + ': ' + error));
    return errors.length === 0;
  }

  const sourcesPath = join(root, 'references', 'sources.json');
  let sources = readJson(sourcesPath);
  if (sources && !validateDocument(sourcesPath, 'sources', sources)) sources = null;
  const sourceEntries = Array.isArray(sources?.sources) ? sources.sources : [];
  const sourceIds = new Set(sourceEntries.map(source => source.id));
  for (const duplicate of findDuplicates(sourceEntries.map(source => source.id))) {
    failures.push(`${label(sourcesPath)}: duplicate source id ${duplicate}`);
  }

  const specimenPaths = walkMatching(join(root, 'specimens'), 'specimen.json');
  const specimens = [];

  for (const path of specimenPaths) {
    const specimen = readJson(path);
    if (!specimen) continue;
    if (!validateDocument(path, 'specimen', specimen)) continue;
    specimens.push({ path, specimen });

    for (const artifact of specimen.artifacts ?? []) {
      if (!artifact || typeof artifact.path !== 'string') continue;
      const specimenDirectory = dirname(path);
      const artifactPath = resolve(specimenDirectory, artifact.path);
      if (!isInside(specimenDirectory, artifactPath)) {
        failures.push(`${label(path)}: artifact path escapes specimen directory: ${artifact.path}`);
        continue;
      }
      if (!existsSync(artifactPath)) {
        failures.push(`${label(path)}: missing artifact ${artifact.path}`);
        continue;
      }

      const bytes = readFileSync(artifactPath);
      const digest = createHash('sha256').update(bytes).digest('hex');
      if (bytes.length !== artifact.bytes) {
        failures.push(`${label(artifactPath)}: expected ${artifact.bytes} bytes, got ${bytes.length}`);
      }
      if (digest !== artifact.sha256) failures.push(`${label(artifactPath)}: SHA-256 mismatch`);
      if (artifact.format === 'STEP' && !bytes.subarray(0, 32).toString('utf8').startsWith('ISO-10303-21')) {
        failures.push(`${label(artifactPath)}: not ISO-10303-21`);
      }
    }

    for (const referencedPath of [specimen.evidence, ...(specimen.mappings ?? [])].filter(Boolean)) {
      const target = resolve(dirname(path), referencedPath);
      if (!isInside(dirname(path), target)) {
        failures.push(`${label(path)}: referenced path escapes specimen directory: ${referencedPath}`);
      } else if (!existsSync(target)) {
        failures.push(`${label(path)}: missing referenced file ${referencedPath}`);
      }
    }
  }

  if (specimens.length === 0) failures.push('no specimen.json found');
  for (const duplicate of findDuplicates(specimens.map(({ specimen }) => specimen.id))) {
    failures.push(`duplicate specimen id ${duplicate}`);
  }

  const catalogPath = join(root, 'catalog.json');
  let catalog = readJson(catalogPath);
  if (catalog && !validateDocument(catalogPath, 'catalog', catalog)) catalog = null;
  const catalogEntries = Array.isArray(catalog?.specimens) ? catalog.specimens : [];

  for (const duplicate of findDuplicates(catalogEntries.map(entry => entry.id))) {
    failures.push(`${label(catalogPath)}: duplicate specimen id ${duplicate}`);
  }
  if (catalog) {
    const templateCount = catalogEntries.filter(entry => entry.entryKind === 'template').length;
    const experimentalRecordCount = catalogEntries.filter(entry => entry.entryKind === 'experimental-record').length;
    if (catalog.specimenCount !== catalogEntries.length) {
      failures.push(`${label(catalogPath)}: specimenCount ${catalog.specimenCount} does not match ${catalogEntries.length} entries`);
    }
    if (catalog.templateCount !== templateCount) {
      failures.push(`${label(catalogPath)}: templateCount ${catalog.templateCount} does not match ${templateCount} template entries`);
    }
    if (catalog.experimentalRecordCount !== experimentalRecordCount) {
      failures.push(`${label(catalogPath)}: experimentalRecordCount ${catalog.experimentalRecordCount} does not match ${experimentalRecordCount} experimental entries`);
    }
  }

  const specimenById = new Map(specimens.map(entry => [entry.specimen.id, entry]));
  const catalogById = new Map(catalogEntries.map(entry => [entry.id, entry]));
  for (const id of [...specimenById.keys()].sort()) {
    if (!catalogById.has(id)) failures.push(`${label(catalogPath)}: specimen ${id} is not indexed`);
  }
  for (const id of [...catalogById.keys()].sort()) {
    const stored = specimenById.get(id);
    if (!stored) {
      failures.push(`${label(catalogPath)}: indexed specimen ${id} has no specimen.json`);
      continue;
    }
    const entry = catalogById.get(id);
    const specimen = stored.specimen;
    if (entry.family !== specimen.design?.geometryFamily) {
      failures.push(`${label(catalogPath)}: ${id} family does not match specimen.json`);
    }
    if (entry.title !== specimen.title) failures.push(`${label(catalogPath)}: ${id} title does not match specimen.json`);
    if (!equalArrays(entry.purpose, specimen.purpose)) {
      failures.push(`${label(catalogPath)}: ${id} purpose does not match specimen.json`);
    }
  }

  const lineagePaths = walkMatching(join(root, 'studies'), 'spatial-lineage.json');
  const lineages = [];

  for (const path of lineagePaths) {
    const record = readJson(path);
    if (!record) continue;
    if (!validateDocument(path, 'spatial-lineage', record)) continue;
    lineages.push({ path, record });
    for (const error of validateSpatialRecord(record, sourceIds, dirname(path))) {
      failures.push(label(path) + ': ' + error);
    }
  }

  return {
    failures,
    counts: {
      specimens: specimens.length,
      catalogEntries: catalogEntries.length,
      spatialLineages: lineages.length,
      sources: sourceEntries.length
    }
  };
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const result = validateLibrary();
  if (result.failures.length) {
    console.error(result.failures.join('\n'));
    process.exit(1);
  }
  const { specimens, catalogEntries, spatialLineages, sources } = result.counts;
  console.log(
    `AddiSpec validation passed: ${specimens} specimen(s), ${catalogEntries} catalogue entry(ies), `
    + `${spatialLineages} spatial-lineage record(s), ${sources} source(s)`
  );
}
