import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, mkdtempSync, writeFileSync, rmSync, cpSync, symlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { validateAgainstSchema, validateRightHandedBasis } from './lib/validation.mjs';
import { validateDocument, schemaFor } from './lib/contracts.mjs';
import { validateSpatialRecord, transformPoint } from './lib/spatial.mjs';
import { migrateDocument } from './migrate-document.mjs';
import { validateLibrary } from './validate-library.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const examplePath = join(root, 'studies/pbf-lbm/synthetic-retained/spatial-lineage.json');
const fixture = () => JSON.parse(readFileSync(examplePath));
const sourceIds = new Set(fixture().sourceRefs);
const ev = { status: 'reported', sourceRef: 'synthetic-reference-example', locator: 'Synthetic test definition' };
const basis = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
const definition = { status: 'specified', origin: 'Synthetic origin', axes: { x: 'Synthetic X', y: 'Synthetic Y', z: 'Synthetic Z' }, evidence: ev };
const numeric = () => {
  const record = fixture();
  record.coordinateFrames = [
    { id: 'root-frame', frameType: 'build', definition, transformToParent: { status: 'not-applicable' } },
    { id: 'sample-frame', frameType: 'sample', parentFrameRef: 'root-frame', definition,
      transformToParent: { status: 'exact', model: 'rigid', direction: 'child-to-parent', translationMm: [10, 20, 30], basis,
        appliesTo: ['retained-coupon'], evidence: ev } }
  ];
  record.entities[0].coordinateFrameRef = 'sample-frame';
  return structuredClone(record);
};
function check(record, directory = dirname(examplePath)) {
  const structure = validateDocument(root, examplePath, 'spatial-lineage', record);
  return structure.length ? structure : validateSpatialRecord(record, sourceIds, directory);
}
const failure = (record, pattern) => assert.match(check(record).join('\n'), pattern);

test('coarse retained specimen requires neither geometry, frame nor laboratory result', () => assert.deepEqual(check(fixture()), []));
test('explicit nominal rigid transform maps child coordinates into parent using basis columns', () => {
  const r = numeric();
  r.coordinateFrames[1].transformToParent.basis = { x: [0, 1, 0], y: [-1, 0, 0], z: [0, 0, 1] };
  assert.deepEqual(check(r), []);
  assert.deepEqual(transformPoint(r.coordinateFrames[1].transformToParent, [2, 3, 4]), [7, 22, 34]);
});
for (const [name, mutate, pattern] of [
  ['mirrored basis', r => { r.coordinateFrames[1].transformToParent.basis.z = [0, 0, -1]; }, /right-handed/],
  ['non-orthonormal basis', r => { r.coordinateFrames[1].transformToParent.basis.y = [1, 1, 0]; }, /normalized|orthogonal/],
  ['malformed basis', r => { r.coordinateFrames[1].transformToParent.basis.x = [1, 0]; }, /at least 3/],
  ['unknown parent frame', r => { r.coordinateFrames[1].parentFrameRef = 'absent'; }, /unknown reference target/],
  ['frame cycle', r => { r.coordinateFrames[0].parentFrameRef = 'sample-frame'; r.coordinateFrames[0].transformToParent = { status: 'not-reported' }; }, /coordinate-frame cycle/],
  ['wrong transform direction', r => { r.coordinateFrames[1].transformToParent.direction = 'parent-to-child'; }, /expected constant/],
  ['numeric not-reported', r => { r.coordinateFrames[1].transformToParent.status = 'not-reported'; }, /must not contain numeric/],
  ['exact and unknown contradiction', r => { r.coordinateFrames[1].definition = { status: 'not-reported' }; }, /requires specified/],
  ['numeric transform without evidence', r => { delete r.coordinateFrames[1].transformToParent.evidence; }, /evidence required/],
  ['schematic as exact transform', r => { r.coordinateFrames[1].transformToParent.evidence.status = 'schematic-only'; }, /schematic-only/],
  ['unknown transform applicability', r => { r.coordinateFrames[1].transformToParent.appliesTo = ['absent']; }, /unknown reference target/],
]) test(name, () => { const r = numeric(); mutate(r); failure(r, pattern); });

test('transform utility rejects the wrong direction before calculating', () => {
  const t = numeric().coordinateFrames[1].transformToParent;
  t.direction = 'parent-to-child';
  assert.throws(() => transformPoint(t, [1, 2, 3]), /Unsupported transform convention/);
});
test('basis validation rejects non-finite numbers', () => {
  for (const n of [NaN, Infinity, '1']) assert.match(validateRightHandedBasis({ ...basis, x: [n, 0, 0] }).join(), /finite/);
});
test('unknown transform remains nonnumeric', () => {
  const r = numeric(); r.coordinateFrames[1].transformToParent = { status: 'not-reported' };
  assert.deepEqual(check(r), []);
  assert.throws(() => transformPoint(r.coordinateFrames[1].transformToParent, [0, 0, 0]), /not numerically known/);
});
for (const status of ['estimated', 'measured', 'computed']) test(status + ' requires method, evidence and uncertainty', () => {
  const r = numeric(), t = r.coordinateFrames[1].transformToParent;
  t.status = status; t.evidence = { ...ev, status, method: 'Synthetic test procedure' };
  failure(r, /requires uncertainty/);
  t.uncertainty = { description: 'Synthetic bound; translation 0.5 mm, rotation unquantified', translationBoundMm: 0.5 };
  assert.deepEqual(check(r), []);
  delete t.evidence.method; failure(r, /method required/);
});
test('relative orientation has no absolute translation or invented azimuth', () => {
  const r = numeric();
  r.coordinateFrames[1].transformToParent = { status: 'not-reported' };
  r.coordinateFrames.forEach(f => { f.definition = { status: 'not-reported' }; });
  r.orientationConstraints = [{ id: 'relative-angle', subjectRef: 'retained-coupon', relationType: 'axis-to-axis',
    first: { frameRef: 'sample-frame', feature: 'specimen longitudinal axis' },
    second: { frameRef: 'root-frame', feature: 'reported build direction' },
    angleDeg: 45, azimuthStatus: 'not-reported', evidence: ev }];
  assert.deepEqual(check(r), []);
  assert.equal(r.coordinateFrames[1].transformToParent.translationMm, undefined);
});
test('lineage cycle and unknown targets are rejected', () => {
  const r = fixture();
  r.entities.push({ id: 'prepared-sample', scope: 'individual', role: 'prepared-sample' });
  r.derivations = [{ type: 'prepared-from', parentRef: 'retained-coupon', childRef: 'prepared-sample', evidence: ev }];
  assert.deepEqual(check(r), []);
  r.derivations.push({ type: 'sectioned-from', parentRef: 'prepared-sample', childRef: 'retained-coupon', evidence: ev });
  failure(r, /derivation cycle/);
  r.derivations[1].childRef = 'absent'; failure(r, /unknown reference target/);
});
test('unknown external reference and unknown evidence source are rejected', () => {
  const r = fixture(); r.entities[0].externalReferenceRefs.push('absent'); failure(r, /unknown reference target/);
  const s = fixture(); s.externalReferences[0].provenance.sourceRef = 'absent'; failure(s, /unknown source/);
});
test('AAS reference requires pinned model and target identifier', () => {
  const r = fixture(); delete r.externalReferences[0].expectedModel; failure(r, /AAS requires/);
  const s = fixture(); s.externalReferences[0].identifiers = {}; failure(s, /identifier required/);
});
test('unresolved external target remains valid evidence state, never resolved silently', () => {
  const r = fixture();
  r.externalReferences[0].resolution = { status: 'unresolved', checkedAt: '2026-09-08T12:00:00Z', reason: 'Synthetic endpoint unavailable' };
  assert.deepEqual(check(r), []);
  delete r.externalReferences[0].resolution.reason; failure(r, /requires reason/);
});
test('resolved receipt must match identifiers and expected semantic version', () => {
  const r = fixture(), ref = r.externalReferences[0];
  ref.resolution = { status: 'resolved', checkedAt: '2026-09-08T12:00:00Z', target: { identifiers: structuredClone(ref.identifiers),
    semanticId: ref.expectedModel.semanticId, version: '1', revision: '0' } };
  assert.deepEqual(check(r), []);
  ref.resolution.target.identifiers.submodelId = 'urn:wrong'; failure(r, /identifier mismatch/);
  ref.resolution.target.identifiers = ref.identifiers; ref.resolution.target.semanticId = 'urn:wrong'; failure(r, /model mismatch/);
});
test('snapshot integrity and real path containment including symlinks', t => {
  const dir = mkdtempSync(join(tmpdir(), 'addispec-snapshot-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const bytes = Buffer.from('{"synthetic":true}\n'); writeFileSync(join(dir, 'snapshot.json'), bytes);
  const r = fixture();
  r.externalReferences[0].snapshot = { path: 'snapshot.json', bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
    capturedAt: '2026-09-08T12:00:00Z', revision: 'synthetic-v1', evidence: ev };
  assert.deepEqual(check(r, dir), []);
  writeFileSync(join(dir, 'snapshot.json'), 'modified'); assert.match(check(r, dir).join(), /integrity mismatch/);
  symlinkSync(examplePath, join(dir, 'escape.json'));
  r.externalReferences[0].snapshot.path = 'escape.json'; assert.match(check(r, dir).join(), /escapes/);
});
test('measurement region cannot claim exact location without a transform', () => {
  const r = fixture();
  r.measurementRegions = [{ id: 'region-01', entityRef: 'retained-coupon', kind: 'plane', locationStatus: 'exact', orientationStatus: 'not-reported', evidence: ev }];
  failure(r, /numeric region requires located frame/);
});

const legacyCatalog = () => JSON.parse(readFileSync(join(root, 'scripts/fixtures/legacy/catalog-0.2.0.json')));
const currentCatalog = () => JSON.parse(readFileSync(join(root, 'catalog.json')));
test('catalog 0.2.0 migration needs explicit classifications and preserves all old entries', () => {
  const old = legacyCatalog(), before = structuredClone(old);
  assert.throws(() => migrateDocument('catalog', old), /entryKind/);
  const entryKinds = Object.fromEntries(old.specimens.map(x => [x.id, 'template']));
  const next = migrateDocument('catalog', old, { entryKinds });
  assert.equal(next.schemaVersion, '0.3.0'); assert.equal(next.templateCount, 18);
  assert.equal(next.experimentalRecordCount, 0); assert.deepEqual(old, before);
  assert.deepEqual(next.specimens.map(({ entryKind, ...x }) => x), old.specimens);
});
test('consumer rejects missing entryKind, unknown kind and old/unknown versions', () => {
  const schema = schemaFor(root, 'catalog');
  for (const value of [undefined, 'unknown']) {
    const c = currentCatalog(); c.specimens[0].entryKind = value;
    if (value === undefined) delete c.specimens[0].entryKind;
    assert.notEqual(validateAgainstSchema(c, schema).length, 0);
  }
  assert.notEqual(validateAgainstSchema(legacyCatalog(), schema).length, 0);
  const c = currentCatalog(); c.schemaVersion = '99.0.0'; assert.notEqual(validateAgainstSchema(c, schema).length, 0);
});
test('experimental-record is distinct and counted separately from templates', () => {
  const c = currentCatalog(); assert.equal(c.experimentalRecordCount, 1); assert.equal(c.templateCount, 18);
  assert.equal(c.specimens.filter(x => x.entryKind === 'experimental-record').length, 1);
  assert.deepEqual(validateAgainstSchema(c, schemaFor(root, 'catalog')), []);
});
const oldSpecimen = () => {
  const p = { schemaVersion: '0.1.0', id: 'LEGACY-01', status: 'draft',
    process: { category: 'PBF-LB/M', normativeConformance: 'not-claimed' }, purpose: ['test'],
    design: { geometryFamily: 'cube', units: 'mm', nominalDimensions: { side: 10 }, buildOrientation: { buildAxis: 'Z', orientationStatus: 'nominal' } },
    artifacts: [{ role: 'exchange', format: 'STEP', path: 'geometry.step', sha256: '0'.repeat(64), bytes: 1 }],
    provenance: { createdBy: 'synthetic', authoringSystem: 'fixture', createdAt: '2026-09-08' },
    qualification: { manufacturingQualified: false, missingEvidence: ['all physical testing'] } };
  return p;
};
test('historically valid specimen missing new required fields needs reviewed migration', () => {
  const old = oldSpecimen();
  const legacySchema = JSON.parse(readFileSync(join(root, 'scripts/fixtures/legacy/specimen.schema.json')));
  assert.deepEqual(validateAgainstSchema(old, legacySchema), []);
  const errors = validateAgainstSchema(old, schemaFor(root, 'specimen')).join();
  for (const field of ['$schema', 'title', 'coordinateSystem']) assert.ok(errors.includes(field));
  assert.throws(() => migrateDocument('specimen', old), /title/);
  assert.throws(() => migrateDocument('specimen', old, { title: 'Reviewed title' }), /coordinateSystem/);
  const next = migrateDocument('specimen', old, { title: 'Reviewed title', coordinateSystem: 'not-reported' });
  assert.deepEqual(validateAgainstSchema(next, schemaFor(root, 'specimen')), []);
  assert.equal(old.design.coordinateSystem, undefined);
});
test('historical specimen 0.2.0 also migrates explicitly to strict 0.3.0', () => {
  const old = oldSpecimen(); old.schemaVersion = '0.2.0';
  const next = migrateDocument('specimen', old, { title: 'Reviewed', coordinateSystem: 'not-reported' });
  assert.equal(next.schemaVersion, '0.3.0');
  assert.deepEqual(validateAgainstSchema(next, schemaFor(root, 'specimen')), []);
});
test('standalone external-reference schema matches the embedded structural contract', () => {
  const { $schema, $id, title, ...external } = JSON.parse(readFileSync(join(root, 'schemas/0.2.0/external-reference.schema.json')));
  assert.deepEqual(external, schemaFor(root, 'spatial-lineage').properties.externalReferences.items);
});
test('legacy additional fields are neither silently dropped nor accepted by new consumers', () => {
  const old = oldSpecimen(); old.vendorNote = 'preserve this';
  assert.throws(() => migrateDocument('specimen', old, { title: 'Legacy', coordinateSystem: 'not-reported' }), /unexpected property vendorNote/);
  assert.equal(old.vendorNote, 'preserve this');
});
test('schema substitution cannot bypass the registered contract', () => {
  const r = fixture(); r.$schema = '../../../scripts/fixtures/legacy/specimen.schema.json';
  failure(r, /expected registered/);
});
test('CLI writes a new file and refuses to overwrite existing output', t => {
  const dir = mkdtempSync(join(tmpdir(), 'addispec-migration-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const input = join(dir, 'old.json'), metadata = join(dir, 'metadata.json'), output = join(dir, 'new.json');
  writeFileSync(input, JSON.stringify(oldSpecimen())); writeFileSync(metadata, JSON.stringify({ title: 'Legacy', coordinateSystem: 'not-reported' }));
  const args = [join(root, 'scripts/migrate-document.mjs'), 'specimen', input, metadata, output];
  assert.equal(spawnSync(process.execPath, args).status, 0);
  const before = readFileSync(output, 'utf8');
  const retry = spawnSync(process.execPath, args, { encoding: 'utf8' });
  assert.equal(retry.status, 1); assert.match(retry.stderr, /EEXIST/); assert.equal(readFileSync(output, 'utf8'), before);
});
test('library reports malformed structures without crashing', t => {
  const dir = mkdtempSync(join(tmpdir(), 'addispec-invalid-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  cpSync(root, dir, { recursive: true, filter: p => !p.includes('/.git') });
  writeFileSync(join(dir, 'catalog.json'), JSON.stringify({ ...currentCatalog(), specimens: [null] }));
  assert.match(validateLibrary(dir).failures.join(), /expected object/);
});
