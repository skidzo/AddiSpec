import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateLibrary } from './validate-library.mjs';
import {
  findDirectedCycle,
  validateAgainstSchema,
  validateRightHandedBasis,
  validateSupportedSchema
} from './lib/validation.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('the repository satisfies structural and semantic validation', () => {
  const result = validateLibrary(root);
  assert.deepEqual(result.failures, []);
  assert.equal(result.counts.specimens, 19);
  assert.equal(result.counts.catalogEntries, 19);
  assert.equal(result.counts.spatialLineages, 1);
});

test('the schema validator catches required, pattern and additional-property failures', () => {
  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['id'],
    properties: {
      id: { type: 'string', pattern: '^[A-Z]+$' }
    }
  };

  assert.deepEqual(validateAgainstSchema({ id: 'VALID' }, schema), []);
  assert.match(validateAgainstSchema({}, schema).join('\n'), /missing required property id/);
  assert.match(validateAgainstSchema({ id: 'invalid' }, schema).join('\n'), /does not match/);
  assert.match(validateAgainstSchema({ id: 'VALID', extra: true }, schema).join('\n'), /unexpected property extra/);
});

test('schemas cannot silently use unsupported validation keywords', () => {
  assert.deepEqual(validateSupportedSchema({ type: 'string', minLength: 1 }), []);
  assert.match(validateSupportedSchema({ oneOf: [{ type: 'string' }] }).join('\n'), /unsupported schema keyword oneOf/);
});

test('coordinate bases must be normalized, orthogonal and right-handed', () => {
  const valid = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
  const mirrored = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, -1] };

  assert.deepEqual(validateRightHandedBasis(valid), []);
  assert.match(validateRightHandedBasis(mirrored).join('\n'), /right-handed/);
});

test('directed cycles are reported with their closing node', () => {
  assert.equal(findDirectedCycle(new Set(['a', 'b', 'c']), [['a', 'b'], ['b', 'c']]), null);
  assert.deepEqual(
    findDirectedCycle(new Set(['a', 'b', 'c']), [['a', 'b'], ['b', 'c'], ['c', 'a']]),
    ['a', 'b', 'c', 'a']
  );
});
