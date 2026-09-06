import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  findDirectedCycle,
  validateAgainstSchema,
  validateRightHandedBasis,
  validateSupportedSchema
} from './lib/validation.mjs';

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
  const schemaCache = new Map();

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

  function validateDocument(path, document) {
    if (!document || typeof document.$schema !== 'string') {
      failures.push(`${label(path)}: missing local $schema reference`);
      return;
    }

    const schemaPath = resolve(dirname(path), document.$schema);
    if (!isInside(root, schemaPath)) {
      failures.push(`${label(path)}: $schema resolves outside the repository`);
      return;
    }
    if (!existsSync(schemaPath)) {
      failures.push(`${label(path)}: missing schema ${document.$schema}`);
      return;
    }

    let schema = schemaCache.get(schemaPath);
    if (!schema) {
      schema = readJson(schemaPath);
      if (!schema) return;
      for (const error of validateSupportedSchema(schema)) {
        failures.push(`${label(schemaPath)}: ${error}`);
      }
      schemaCache.set(schemaPath, schema);
    }

    for (const error of validateAgainstSchema(document, schema)) {
      failures.push(`${label(path)}: ${error}`);
    }
  }

  const sourcesPath = join(root, 'references', 'sources.json');
  const sources = readJson(sourcesPath);
  if (sources) validateDocument(sourcesPath, sources);
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
    validateDocument(path, specimen);
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
  const catalog = readJson(catalogPath);
  if (catalog) validateDocument(catalogPath, catalog);
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
    validateDocument(path, record);
    lineages.push({ path, record });

    const declaredSourceRefs = new Set(record.sourceRefs ?? []);
    for (const sourceRef of declaredSourceRefs) {
      if (!sourceIds.has(sourceRef)) failures.push(`${label(path)}: unknown sourceRef ${sourceRef}`);
    }

    const entities = Array.isArray(record.entities) ? record.entities : [];
    const frames = Array.isArray(record.coordinateFrames) ? record.coordinateFrames : [];
    const entityIds = new Set(entities.map(entity => entity.id));
    const frameIds = new Set(frames.map(frame => frame.id));

    for (const duplicate of findDuplicates(entities.map(entity => entity.id))) {
      failures.push(`${label(path)}: duplicate entity id ${duplicate}`);
    }
    for (const duplicate of findDuplicates(frames.map(frame => frame.id))) {
      failures.push(`${label(path)}: duplicate coordinate-frame id ${duplicate}`);
    }

    for (const entity of entities) {
      if (entity.coordinateFrameRef && !frameIds.has(entity.coordinateFrameRef)) {
        failures.push(`${label(path)}: entity ${entity.id} references unknown frame ${entity.coordinateFrameRef}`);
      }
      if (entity.geometry?.definitionStatus === 'incomplete' && !(entity.geometry.missingParameters?.length > 0)) {
        failures.push(`${label(path)}: incomplete geometry ${entity.id} must list missingParameters`);
      }
    }

    for (const frame of frames) {
      const transform = frame.transformToParent ?? {};
      const valueBearingStatus = ['exact', 'measured', 'estimated'].includes(transform.status);
      if (frame.parentFrameRef && !frameIds.has(frame.parentFrameRef)) {
        failures.push(`${label(path)}: frame ${frame.id} references unknown parent ${frame.parentFrameRef}`);
      }
      if (!frame.parentFrameRef && transform.status !== 'not-applicable') {
        failures.push(`${label(path)}: root frame ${frame.id} must use transform status not-applicable`);
      }
      if (frame.parentFrameRef && transform.status === 'not-applicable') {
        failures.push(`${label(path)}: child frame ${frame.id} cannot use transform status not-applicable`);
      }
      if (valueBearingStatus) {
        if (!frame.parentFrameRef) failures.push(`${label(path)}: located frame ${frame.id} requires a parent frame`);
        if (transform.model !== 'rigid') {
          failures.push(`${label(path)}: ${transform.status} transform for ${frame.id} requires model rigid`);
        }
        if (!transform.translationMm || !transform.basis) {
          failures.push(`${label(path)}: ${transform.status} transform for ${frame.id} requires translationMm and basis`);
        } else {
          for (const error of validateRightHandedBasis(transform.basis)) {
            failures.push(`${label(path)}: frame ${frame.id}: ${error}`);
          }
        }
      } else if (transform.model || transform.translationMm || transform.basis || transform.uncertaintyMm !== undefined) {
        failures.push(`${label(path)}: ${transform.status} transform for ${frame.id} must not contain numeric transform values`);
      }
    }

    const frameCycle = findDirectedCycle(
      frameIds,
      frames.filter(frame => frame.parentFrameRef).map(frame => [frame.id, frame.parentFrameRef])
    );
    if (frameCycle) failures.push(`${label(path)}: coordinate-frame cycle ${frameCycle.join(' -> ')}`);

    function validateEvidence(evidence, context) {
      if (!evidence?.sourceRef) return;
      if (!sourceIds.has(evidence.sourceRef)) {
        failures.push(`${label(path)}: ${context} references unknown source ${evidence.sourceRef}`);
      } else if (!declaredSourceRefs.has(evidence.sourceRef)) {
        failures.push(`${label(path)}: ${context} source ${evidence.sourceRef} is absent from sourceRefs`);
      }
    }

    const derivations = Array.isArray(record.derivations) ? record.derivations : [];
    for (const derivation of derivations) {
      if (!entityIds.has(derivation.parentRef)) {
        failures.push(`${label(path)}: derivation references unknown parent ${derivation.parentRef}`);
      }
      if (!entityIds.has(derivation.childRef)) {
        failures.push(`${label(path)}: derivation references unknown child ${derivation.childRef}`);
      }
      if (derivation.parentRef === derivation.childRef) {
        failures.push(`${label(path)}: derivation cannot reference ${derivation.parentRef} as both parent and child`);
      }
      validateEvidence(derivation.evidence, `derivation ${derivation.parentRef} -> ${derivation.childRef}`);
    }
    const derivationCycle = findDirectedCycle(
      entityIds,
      derivations.map(derivation => [derivation.parentRef, derivation.childRef])
    );
    if (derivationCycle) failures.push(`${label(path)}: derivation cycle ${derivationCycle.join(' -> ')}`);

    const orientationConstraints = Array.isArray(record.orientationConstraints) ? record.orientationConstraints : [];
    for (const duplicate of findDuplicates(orientationConstraints.map(constraint => constraint.id))) {
      failures.push(`${label(path)}: duplicate orientation-constraint id ${duplicate}`);
    }
    for (const constraint of orientationConstraints) {
      if (!entityIds.has(constraint.subjectRef)) {
        failures.push(`${label(path)}: orientation ${constraint.id} references unknown subject ${constraint.subjectRef}`);
      }
      for (const side of ['first', 'second']) {
        const frameRef = constraint[side]?.frameRef;
        if (frameRef && !frameIds.has(frameRef)) {
          failures.push(`${label(path)}: orientation ${constraint.id} references unknown frame ${frameRef}`);
        }
      }
      validateEvidence(constraint.evidence, `orientation ${constraint.id}`);
    }

    const measurementRegions = Array.isArray(record.measurementRegions) ? record.measurementRegions : [];
    for (const duplicate of findDuplicates(measurementRegions.map(region => region.id))) {
      failures.push(`${label(path)}: duplicate measurement-region id ${duplicate}`);
    }
    for (const region of measurementRegions) {
      if (!entityIds.has(region.entityRef)) {
        failures.push(`${label(path)}: measurement region ${region.id} references unknown entity ${region.entityRef}`);
      }
      if (region.kind === 'grid' && !region.samplingGrid) {
        failures.push(`${label(path)}: grid measurement region ${region.id} requires samplingGrid`);
      }
      validateEvidence(region.evidence, `measurement region ${region.id}`);
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
