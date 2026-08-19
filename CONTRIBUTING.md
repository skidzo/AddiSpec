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
- validation output from `node scripts/validate-library.mjs`.

## Claims

Do not label a specimen as standard-conforming, calibrated, qualified, or validated unless the pull request contains the necessary controlled evidence. Merely citing a standard is not a conformance claim.

## Review levels

1. **Digital geometry verified:** exact geometry and artifact integrity established.
2. **Manufacturing validated:** a documented build and inspection result are linked.
3. **Qualified:** acceptance criteria, uncertainty, responsible authority, and applicable controlled procedure are documented.

## Third-party material

Do not copy standards text or external CAD files without a compatible redistribution license. Prefer links and structured citations for authoritative external sources.
