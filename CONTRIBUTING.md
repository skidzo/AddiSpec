# Contributing to AddiSpec

Contributions should make AM specimen definitions more reproducible, comparable, and semantically usable.

## Required evidence

Every specimen contribution must include:

- a stable identifier and explicit lifecycle status;
- purpose, process category, units, coordinate system, and nominal dimensions;
- parametric source or an explanation why none is available;
- controlled exchange geometry with byte count and SHA-256;
- provenance and license of every imported artifact;
- build orientation and intended manufacturing context;
- an explicit list of missing physical evidence;
- a catalogue entry whose type distinguishes a reusable template from an experimental record;
- schema and semantic validation output from `node --test scripts/*.test.mjs` and `node scripts/validate-library.mjs`.

## Spatial-lineage records

Follow the [spatial contract](docs/spatial-contract.md), [reference contract](docs/external-references.md) and [migration policy](docs/migration.md).

A spatial-lineage contribution must keep the nominal shape separate from the manufactured material history. It must:

- identify the source record and a precise figure, table, or section locator for each reported relationship;
- model each printed artifact, derived specimen, prepared sample, and fracture artifact as a distinct entity;
- connect entities with typed, acyclic derivations;
- allow coarse entities without geometry or coordinate frames; never manufacture missing precision;
- use numeric parent transforms only with documented direction, frame definitions, applicability and evidence; measured/computed/estimated transforms also need uncertainty;
- use `not-reported` when a transform, placement, azimuth, or dimension is unavailable;
- distinguish an exact transform from a reported angular constraint such as parallel or perpendicular;
- record measurement regions and their location status without inventing absolute coordinates.

For axisymmetric geometry, do not assume that geometric symmetry removes the need for a material-history frame. Scan, recoater, gas-flow, build, and loading directions can remain physically relevant even when a rotation leaves the B-rep unchanged.

## Claims

Do not label a specimen as standard-conforming, calibrated, qualified, or validated unless the pull request contains the necessary controlled evidence. Merely citing a standard is not a conformance claim. A schematic in a paper is not sufficient evidence for a CAD reconstruction.

## Review levels

1. **Digital geometry verified:** exact geometry and artifact integrity established.
2. **Manufacturing validated:** a documented build and inspection result are linked.
3. **Qualified:** acceptance criteria, uncertainty, responsible authority, and applicable controlled procedure are documented.

## Third-party material

Do not copy standards text, papers, or external CAD files without a compatible redistribution license. Prefer links, version metadata, integrity digests, and structured citations for authoritative external sources. Pre-proofs and other mutable publication stages must be labelled and reviewed again before evidence is promoted from a later version of record.
