# AddiSpec

**Open, machine-readable specimen definitions and evidence for additive manufacturing.**

AddiSpec is a vendor-neutral library for versioned additive-manufacturing test specimens. Each entry connects design intent, parametric dimensions, exact exchange geometry, integrity hashes, manufacturing context, and qualification evidence without claiming certification that has not been demonstrated. Spatial-lineage records can additionally connect a printed build artifact to extracted specimens, prepared sections, measurement regions, and fracture surfaces.

The project starts with PBF-LB/M and is designed to connect later to Asset Administration Shell (AAS), IDTA submodels, build-job records, material batches, inspection results, and uncertainty statements.

## Why this repository exists

Useful AM test artefacts already exist, including the [NIST AM test artifact](https://www.nist.gov/el/intelligent-systems-division-73500/production-systems-group/nist-additive-manufacturing-test), [NIST AM-Bench](https://www.nist.gov/ambench), and the benchmarking framework described by [ISO/ASTM 52902:2023](https://www.iso.org/standard/79683.html). Position and orientation are addressed by [ISO 17295:2023](https://www.iso.org/standard/76471.html), while [ISO/ASTM 52909:2024](https://www.iso.org/standard/87956.html) specifically addresses orientation and location dependence for mechanical-property specimens. These sources do not form a single open Git repository for reusable parametric definitions plus semantic, revision, and evidence metadata. AddiSpec aims to fill that engineering-integration gap, not replace standards or authoritative datasets.

## Current PBF-LB/M catalogue

The catalogue contains 18 reusable specimen templates plus the original NuCOS density-coupon experimental record, indexed explicitly as 19 distinct entries. It covers density and porosity, metallography, hardness, chemistry and thermal-analysis stock, tensile/compression/fatigue/impact blanks, surface and thin-wall capability, overhangs, dimensional steps, supports, CT, and powder-lot witnesses.

See [`catalog.json`](catalog.json) for the machine-readable index.

The original NuCOS density-coupon record includes:

- one valid exact B-rep solid;
- 6 faces and 12 edges;
- nominal volume: 1,000 mm³;
- STEP artifact with SHA-256;
- two revision-bound agent commits (8 mm to 10 mm height);
- a preliminary AddiBase/AAS mapping.

All 19 entries carry exact STEP geometry and SHA-256 evidence. This verifies the digital geometry workflow only. They are **not yet norm-conforming or manufacturing-qualified specimen definitions**.

## Repository model

```text
schemas/                       JSON schemas
specimens/<process>/<family>/  Versioned specimen entries
  specimen.json                Design intent and parameters
  evidence.json                Digital geometry evidence and hashes
  geometry/                    STEP and other controlled exchange files
  mappings/                    AAS/AddiBase projections
studies/<process>/<study>/      Source-grounded spatial-lineage records
references/                    External source register
scripts/                       Dependency-free validation tools
```

## Initial simulation reference set

The [core-four benchmark](benchmarks/pbf-lbm/core-four/README.md) starts with the
10 mm density cube, 0.5 mm thin wall, corrected 45-degree overhang and a round
5 mm diameter / 25 mm gauge-length tensile reference. Its executable gate checks
STEP import/export, intended geometry and two volume-mesh resolutions. Solver
convergence and manufacturing validation require additional evidence.

The overhang's intended growth direction is **-Y in its stored STEP frame**. The
benchmark supplies an explicit transform to +Z build coordinates and exports the
corrected calculation geometry. The tensile case keeps the printing blank and
finished numerical specimen distinct; its smooth grip model is not a released
standard-conforming manufacturing drawing.

## Spatial lineage

Shape identity and spatial/material identity are deliberately separate. A STEP hash can prove that two files describe the same nominal shape, but it cannot by itself preserve where a specimen was built, how it was cut from a parent artifact, or how its material history is oriented. This is especially important for rotationally symmetric specimens whose CAD geometry does not reveal azimuth relative to scan, recoater, gas-flow, or build coordinates.

A spatial-lineage record therefore provides:

- typed entities for build artifacts, derived test specimens, prepared samples, and fracture artifacts;
- explicit parent-child derivations such as `extracted-from`, `sectioned-from`, and `fractured-from`;
- optional local coordinate frames with nominal-exact, reported, measured, computed, estimated, or explicitly unreported rigid transforms;
- orientation constraints when a source reports only relationships such as parallel or perpendicular;
- measurement regions such as planes, grids, and fracture surfaces;
- evidence locators and explicit gaps instead of inferred geometry.

See the [synthetic retained-specimen mapping](studies/pbf-lbm/synthetic-retained/README.md). Coarse categories are valid without geometry or coordinate frames. The Xu literature case is handled separately in the [AM Data Model Atlas](https://github.com/skidzo/AM-Data-Model-Atlas).

The [approved ADR](docs/adr/0001-spatial-reference-contract.md) defines system ownership. See the [spatial contract](docs/spatial-contract.md), [external-reference contract](docs/external-references.md) and [breaking-change migration](docs/migration.md). Catalog and specimen contracts are 0.3.0; spatial lineage and sources are 0.2.0.

## Validation

Requires Node.js 22 or 24:

```bash
node --test scripts/*.test.mjs
node scripts/validate-library.mjs
```

The validation selects registered, versioned repository JSON Schemas and checks their supported structural constraints; documents cannot select a weaker schema. It also checks catalogue completeness, source references, artifact presence, path containment, SHA-256 integrity, basic STEP identity, coordinate-frame bases and cycles, derivation cycles, and cross-record references. It does not establish physical conformance or certification.

## Contribution principles

1. Keep nominal design, generated artifact, manufacturing instance, and measured result distinct.
2. Record provenance and integrity hashes for every controlled geometry artifact.
3. State normative references precisely, but never imply standards compliance without evidence.
4. Preserve units, coordinate system, build orientation, revision, and uncertainty explicitly.
5. Prefer parametric source definitions; treat STEP as controlled exchange evidence rather than design intent.
6. Preserve unknown position, orientation, and dimensions as explicit evidence gaps; never manufacture precision from a schematic.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the proposed review gate.

## Licensing

Repository-authored code, schemas, and metadata are licensed under the [MIT License](LICENSE). Imported or referenced third-party geometries retain their own terms and must carry explicit provenance. No third-party standard text is redistributed.
