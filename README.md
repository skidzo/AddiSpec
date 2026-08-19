# AddiSpec

**Open, machine-readable specimen definitions and evidence for additive manufacturing.**

AddiSpec is a vendor-neutral library for versioned additive-manufacturing test specimens. Each entry connects design intent, parametric dimensions, exact exchange geometry, integrity hashes, manufacturing context, and qualification evidence without claiming certification that has not been demonstrated.

The project starts with PBF-LB/M and is designed to connect later to Asset Administration Shell (AAS), IDTA submodels, build-job records, material batches, inspection results, and uncertainty statements.

## Why this repository exists

Useful AM test artefacts already exist, including the [NIST AM test artifact](https://www.nist.gov/el/intelligent-systems-division-73500/production-systems-group/nist-additive-manufacturing-test), [NIST AM-Bench](https://www.nist.gov/ambench), and the benchmarking framework described by [ISO/ASTM 52902:2023](https://www.iso.org/standard/79683.html). They do not form a single open Git repository for reusable parametric definitions plus semantic, revision, and evidence metadata. AddiSpec aims to fill that engineering-integration gap, not replace standards or authoritative datasets.

## Current PBF-LB/M catalogue

The first catalogue contains 18 reusable specimen templates plus the original NuCOS density-coupon experiment. It covers density and porosity, metallography, hardness, chemistry and thermal-analysis stock, tensile/compression/fatigue/impact blanks, surface and thin-wall capability, overhangs, dimensional steps, supports, CT, and powder-lot witnesses.

See [`catalog.json`](catalog.json) for the machine-readable index.

Verified digital evidence:

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
references/                    External source register
scripts/                       Dependency-free validation tools
```

## Validation

Requires Node.js 20 or newer:

```bash
node scripts/validate-library.mjs
```

The validation checks JSON syntax, schema-critical fields, artifact presence, SHA-256 integrity, and basic STEP identity. It does not establish physical conformance or certification.

## Contribution principles

1. Keep nominal design, generated artifact, manufacturing instance, and measured result distinct.
2. Record provenance and integrity hashes for every controlled geometry artifact.
3. State normative references precisely, but never imply standards compliance without evidence.
4. Preserve units, coordinate system, build orientation, revision, and uncertainty explicitly.
5. Prefer parametric source definitions; treat STEP as controlled exchange evidence rather than design intent.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the proposed review gate.

## Licensing

Repository-authored code, schemas, and metadata are licensed under the [MIT License](LICENSE). Imported or referenced third-party geometries retain their own terms and must carry explicit provenance. No third-party standard text is redistributed.
