import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { schemaFor, versions } from './lib/contracts.mjs';
import { validateAgainstSchema } from './lib/validation.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function migrateDocument(kind, input, metadata = {}, schemaReference) {
  const output = structuredClone(input);
  if (kind === 'specimen') {
    if (!['0.1.0', '0.2.0'].includes(input.schemaVersion)) throw new Error('Expected legacy specimen 0.1.0 or 0.2.0; migration does not guess versions');
    const legacy = JSON.parse(readFileSync(resolve(root, 'schemas/specimen.schema.json')));
    const errors = validateAgainstSchema(input, legacy);
    if (errors.length) throw new Error('Invalid legacy specimen: ' + errors.join('; '));
    for (const key of ['title']) {
      if (!output[key] && !metadata[key]) throw new Error('Missing ' + key + ': supply reviewed metadata; input preserved');
      if (!output[key]) output[key] = metadata[key];
    }
    if (!output.design.coordinateSystem) {
      if (!metadata.coordinateSystem) throw new Error('Missing coordinateSystem: supply reviewed metadata; never infer axes');
      output.design.coordinateSystem = metadata.coordinateSystem;
    }
  } else if (kind === 'catalog') {
    if (input.schemaVersion !== '0.2.0' || !Array.isArray(input.specimens)) throw new Error('Expected catalog 0.2.0 with specimens');
    output.specimens = input.specimens.map(entry => {
      if (!['template', 'experimental-record'].includes(metadata.entryKinds?.[entry.id])) {
        throw new Error('Missing reviewed entryKind for ' + entry.id);
      }
      return { ...entry, entryKind: metadata.entryKinds[entry.id] };
    });
    output.specimenCount = output.specimens.length;
    output.templateCount = output.specimens.filter(x => x.entryKind === 'template').length;
    output.experimentalRecordCount = output.specimens.filter(x => x.entryKind === 'experimental-record').length;
  } else throw new Error('Only specimen and catalog migration is supported');
  output.schemaVersion = versions[kind];
  output.$schema = schemaReference ?? 'schemas/' + versions[kind] + '/' + kind + '.schema.json';
  const errors = validateAgainstSchema(output, schemaFor(root, kind));
  if (errors.length) throw new Error('Migration needs review (no fields discarded): ' + errors.join('; '));
  return output;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [kind, inputPath, metadataPath, outputPath, ...extra] = process.argv.slice(2);
    if (!outputPath || extra.length) throw new Error('Usage: node scripts/migrate-document.mjs specimen|catalog INPUT METADATA OUTPUT');
    const schemaReference = relative(dirname(resolve(outputPath)), resolve(root, 'schemas', versions[kind] ?? '', kind + '.schema.json'));
    const output = migrateDocument(kind, JSON.parse(readFileSync(inputPath)), JSON.parse(readFileSync(metadataPath)), schemaReference);
    writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n', { flag: 'wx' });
    console.log('Created ' + outputPath + '; original input unchanged');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
