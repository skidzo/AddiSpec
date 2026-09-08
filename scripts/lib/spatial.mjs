import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';
import { findDirectedCycle, validateRightHandedBasis } from './validation.mjs';

export const BASIS_TOLERANCE = 1e-6;
const numericStatuses = new Set(['exact', 'reported', 'measured', 'computed', 'estimated']);
const has = (x, k) => Object.hasOwn(x, k);
const timestamp = value => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  && Number.isFinite(Date.parse(value));

export function transformPoint(transform, point) {
  if (!numericStatuses.has(transform.status)) throw new Error('Transform is not numerically known');
  if (transform.model !== 'rigid' || transform.direction !== 'child-to-parent') throw new Error('Unsupported transform convention');
  const errors = validateRightHandedBasis(transform.basis, BASIS_TOLERANCE);
  if (errors.length || ![point, transform.translationMm].every(v => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite))) {
    throw new Error('Invalid rigid transform or point');
  }
  return transform.translationMm.map((offset, i) => offset
    + transform.basis.x[i] * point[0] + transform.basis.y[i] * point[1] + transform.basis.z[i] * point[2]);
}

// Called only after structural validation. No endpoint is contacted.
export function validateSpatialRecord(record, sourceIds, directory) {
  const errors = [];
  const fail = message => errors.push(message);
  const declared = new Set(record.sourceRefs);
  for (const id of declared) if (!sourceIds.has(id)) fail('unknown sourceRef ' + id);
  const evidence = (value, context) => {
    if (!value) { fail(context + ': evidence required'); return; }
    if (!sourceIds.has(value.sourceRef)) fail(context + ': unknown source ' + value.sourceRef);
    if (!declared.has(value.sourceRef)) fail(context + ': source absent from sourceRefs ' + value.sourceRef);
    if (['measured', 'computed', 'estimated'].includes(value.status) && !value.method) fail(context + ': method required');
  };
  const index = (items, kind) => {
    const map = new Map();
    for (const item of items) {
      if (map.has(item.id)) fail('duplicate ' + kind + ' id ' + item.id);
      map.set(item.id, item);
    }
    return map;
  };
  const entities = index(record.entities, 'entity');
  const frames = index(record.coordinateFrames, 'frame');
  const references = index(record.externalReferences, 'external reference');
  const constraints = index(record.orientationConstraints, 'orientation');
  index(record.measurementRegions, 'measurement region');
  const requireRef = (map, id, context) => { if (!map.has(id)) fail(context + ': unknown reference target ' + id); };

  for (const ref of references.values()) {
    const ids = ref.identifiers;
    if (![ids.assetId, ids.submodelId, ids.entityId].some(Boolean)) fail(ref.id + ': target identifier required');
    if (ids.elementPath && (!ids.submodelId || ids.elementPath.length === 0)) fail(ref.id + ': elementPath needs submodelId and nonempty path');
    if (ref.kind === 'aas' && (!ids.submodelId || !ref.expectedModel)) fail(ref.id + ': AAS requires submodelId and expectedModel');
    evidence(ref.provenance, ref.id);
    const state = ref.resolution;
    if (state.status === 'not-attempted') {
      if (state.checkedAt || state.target) fail(ref.id + ': not-attempted cannot claim checkedAt or target');
    } else if (!timestamp(state.checkedAt)) fail(ref.id + ': resolution requires checkedAt with timezone');
    if (state.status === 'unresolved' && (!state.reason || state.target)) fail(ref.id + ': unresolved requires reason and forbids target');
    if (state.status === 'resolved') {
      if (!state.target) fail(ref.id + ': resolved requires target receipt');
      else {
        for (const [key, value] of Object.entries(ids)) {
          if (JSON.stringify(state.target.identifiers[key]) !== JSON.stringify(value)) fail(ref.id + ': resolved identifier mismatch ' + key);
        }
        if (ref.expectedModel) for (const key of ['semanticId', 'version', 'revision']) {
          if (state.target[key] !== ref.expectedModel[key]) fail(ref.id + ': resolved model mismatch ' + key);
        }
      }
    }
    if (ref.snapshot) {
      const snap = ref.snapshot;
      evidence(snap.evidence, ref.id + ' snapshot');
      if (!timestamp(snap.capturedAt)) fail(ref.id + ': snapshot capturedAt requires timezone');
      try {
        const base = realpathSync(directory);
        const file = realpathSync(resolve(directory, snap.path));
        const rel = relative(base, file);
        if (isAbsolute(snap.path) || rel === '..' || rel.startsWith('../') || isAbsolute(rel)) throw new Error('snapshot path escapes record directory');
        const bytes = readFileSync(file);
        if (bytes.length !== snap.bytes || createHash('sha256').update(bytes).digest('hex') !== snap.sha256) fail(ref.id + ': snapshot integrity mismatch');
      } catch (error) { fail(ref.id + ': snapshot unavailable: ' + error.message); }
    }
  }

  for (const entity of entities.values()) {
    if (entity.coordinateFrameRef) requireRef(frames, entity.coordinateFrameRef, entity.id);
    for (const ref of entity.externalReferenceRefs ?? []) requireRef(references, ref, entity.id);
    if (entity.geometry?.definitionStatus === 'incomplete' && !entity.geometry.missingParameters?.length) fail(entity.id + ': incomplete geometry requires missingParameters');
    if (entity.geometry?.definitionStatus === 'not-reported' && entity.geometry.parameters) fail(entity.id + ': not-reported geometry forbids parameters');
  }

  for (const frame of frames.values()) {
    const t = frame.transformToParent;
    if (frame.parentFrameRef) requireRef(frames, frame.parentFrameRef, 'parent frame ' + frame.id);
    if (!frame.parentFrameRef && t.status !== 'not-applicable') fail(frame.id + ': root frame must use not-applicable');
    if (frame.parentFrameRef && t.status === 'not-applicable') fail(frame.id + ': child frame cannot use not-applicable');
    const definition = frame.definition;
    if (definition.status === 'specified') {
      if (!definition.origin || !definition.axes) fail(frame.id + ': specified frame requires origin and axes');
      evidence(definition.evidence, frame.id + ' definition');
      if (['not-reported', 'schematic-only'].includes(definition.evidence?.status)) fail(frame.id + ': specified frame needs evidence beyond a schematic or unknown statement');
    } else if (definition.origin || definition.axes) fail(frame.id + ': not-reported frame forbids origin and axes');
    if (numericStatuses.has(t.status)) {
      if (t.model !== 'rigid' || t.direction !== 'child-to-parent' || !t.translationMm || !t.basis) fail(frame.id + ': numeric transform requires model, direction, translationMm and basis');
      if (definition.status !== 'specified' || frames.get(frame.parentFrameRef)?.definition.status !== 'specified') fail(frame.id + ': numeric transform requires specified child and parent frames');
      for (const err of validateRightHandedBasis(t.basis, BASIS_TOLERANCE)) fail(frame.id + ': ' + err);
      evidence(t.evidence, frame.id + ' transform');
      if (t.evidence && ['not-reported', 'schematic-only'].includes(t.evidence.status)) fail(frame.id + ': numeric transform cannot use unreported or schematic-only evidence');
      if (['measured', 'computed', 'estimated', 'reported'].includes(t.status) && t.evidence?.status !== t.status) fail(frame.id + ': transform and evidence status disagree');
      if (t.status === 'exact' && !['reported', 'computed'].includes(t.evidence?.status)) fail(frame.id + ': exact only describes a documented nominal definition or exact calculation');
      if (['measured', 'estimated', 'computed'].includes(t.status) && !t.uncertainty) fail(frame.id + ': ' + t.status + ' transform requires uncertainty');
      if (t.status === 'exact' && t.uncertainty) fail(frame.id + ': exact transform cannot claim uncertainty');
      if (!t.appliesTo?.length) fail(frame.id + ': transform requires appliesTo');
      for (const id of t.appliesTo ?? []) requireRef(entities, id, frame.id + ' appliesTo');
    } else {
      for (const field of ['model', 'direction', 'translationMm', 'basis', 'uncertainty', 'appliesTo']) {
        if (has(t, field)) fail(frame.id + ': ' + t.status + ' must not contain numeric transform values or numeric scope (' + field + ')');
      }
      if (t.evidence) evidence(t.evidence, frame.id);
    }
  }
  const frameCycle = findDirectedCycle(frames.keys(), record.coordinateFrames.filter(f => f.parentFrameRef).map(f => [f.id, f.parentFrameRef]));
  if (frameCycle) fail('coordinate-frame cycle ' + frameCycle.join(' -> '));

  for (const d of record.derivations) {
    requireRef(entities, d.parentRef, 'derivation parent');
    requireRef(entities, d.childRef, 'derivation child');
    evidence(d.evidence, 'derivation');
  }
  const cycle = findDirectedCycle(entities.keys(), record.derivations.map(d => [d.parentRef, d.childRef]));
  if (cycle) fail('derivation cycle ' + cycle.join(' -> '));
  for (const c of constraints.values()) {
    requireRef(entities, c.subjectRef, c.id);
    requireRef(frames, c.first.frameRef, c.id);
    requireRef(frames, c.second.frameRef, c.id);
    evidence(c.evidence, c.id);
    if (c.relationType !== 'axis-to-axis' && c.angleDeg > 90) fail(c.id + ': plane angles must be <= 90 degrees');
    if (['schematic-only', 'not-reported'].includes(c.evidence.status)) fail(c.id + ': numeric angle requires reported or derived evidence beyond a schematic');
  }
  for (const p of record.placementObservations ?? []) {
    requireRef(entities, p.entityRef, 'placement');
    if (p.referenceRef) requireRef(references, p.referenceRef, 'placement');
    evidence(p.evidence, 'placement');
    if (p.evidence.status === 'not-reported') fail('placement: not-reported cannot carry a category value');
  }
  for (const m of record.measurementRegions) {
    requireRef(entities, m.entityRef, m.id);
    if (m.coordinateFrameRef) requireRef(frames, m.coordinateFrameRef, m.id);
    if (m.orientationConstraintRef) requireRef(constraints, m.orientationConstraintRef, m.id);
    evidence(m.evidence, m.id);
    if (m.kind === 'grid' && !m.samplingGrid) fail(m.id + ': grid requires samplingGrid');
    if (m.locationStatus === 'feature-relative' && !m.anchor) fail(m.id + ': feature-relative region requires anchor');
    if (m.locationStatus === 'not-reported' && (m.coordinateFrameRef || m.anchor)) fail(m.id + ': not-reported location cannot claim frame or anchor');
    if (numericStatuses.has(m.locationStatus) || numericStatuses.has(m.orientationStatus)) {
      const t = frames.get(m.coordinateFrameRef)?.transformToParent;
      if (!t || !numericStatuses.has(t.status)) fail(m.id + ': numeric region requires located frame');
      else {
        for (const status of [m.locationStatus, m.orientationStatus].filter(x => numericStatuses.has(x))) {
          if (status !== t.status) fail(m.id + ': region and transform status disagree');
        }
      }
    }
    if (m.orientationStatus === 'reported-constraint' && !m.orientationConstraintRef) fail(m.id + ': reported-constraint requires orientationConstraintRef');
    if (m.orientationStatus === 'not-reported' && m.orientationConstraintRef) fail(m.id + ': not-reported orientation cannot claim constraint');
  }
  return errors;
}
