import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { validateAgainstSchema, validateSupportedSchema } from './validation.mjs';

export const versions = Object.freeze({ specimen: '0.3.0', catalog: '0.3.0', sources: '0.2.0', 'spatial-lineage': '0.2.0' });

export function schemaFor(root, kind) {
  if (!Object.hasOwn(versions, kind)) throw new Error('Unknown document kind: ' + kind);
  return JSON.parse(readFileSync(resolve(root, 'schemas', versions[kind], kind + '.schema.json'), 'utf8'));
}

// The document cannot choose the schema used by the validator.
export function validateDocument(root, path, kind, document) {
  const schema = schemaFor(root, kind);
  const errors = validateSupportedSchema(schema);
  errors.push(...validateAgainstSchema(document, schema));
  if (typeof document?.$schema === 'string') {
    const expected = resolve(root, 'schemas', versions[kind], kind + '.schema.json');
    if (resolve(dirname(path), document.$schema) !== expected) {
      errors.push('$schema: expected registered ' + kind + ' schema ' + versions[kind]);
    }
  }
  return errors;
}
