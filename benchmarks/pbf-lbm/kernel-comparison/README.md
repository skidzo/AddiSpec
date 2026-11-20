# AddiSpec thin-wall kernel comparison

This CAD benchmark derives a drilled and rounded wall from the Core Four
[40 × 0.5 × 20 mm thin-wall reference](../core-four/manifest.json).
Both kernels first read that controlled STEP and verify its 400 mm³ volume.
The derived cases then independently construct a solid from the recipe in each
kernel. In benchmark coordinates the wall is 40 mm along X, 20 mm along Y and
has thickness along Z. The right-handed transform from the stored STEP is
`(x, y, z) → (x + 40, z, −y)`. The drill runs along +Z at X = 20.
The round is along the X edge where Y = 20 and Z equals the wall thickness.

## Geometry checks

| Case | Thickness | Bore radius | Round radius | Bore center Y |
|---|---:|---:|---:|---:|
| Drilled control | 0.5 mm | 2 mm | 0 mm | 10 mm |
| Nominal | 0.5 mm | 2 mm | 0.2 mm | 10 mm |
| Thin | 0.1 mm | 2 mm | 0.04 mm | 10 mm |
| Thin web | 0.5 mm | 1 mm | 0.2 mm | 18.7999 mm |
| Bore intersects round | 0.5 mm | 1 mm | 0.2 mm | 18.9 mm |
| Radius exceeds wall | 0.5 mm | 2 mm | 0.6 mm | 10 mm |

The oracle subtracts the bore and round volumes from the box and restores their
overlap via quadrature where needed. The volume tolerance is 0.0001 mm³.
Both kernels must return one valid solid. Two wall-normal measurements check
the planar thickness and the thickness within the round. A third ray checks
that the bore remains open at its center. These are local probes, so the
benchmark does not report a minimum wall thickness map. The nominal gap
between the bore and the upper tangent edge is 0.0001 mm for the thin-web case.

For the two round-to-plane transitions, six samples measure G0 gap (within
0.000002 mm), G1 normal angle (within 0.00001 rad) and the G2 normal
curvature jump (within 0.001 mm⁻¹ of 1/R). The circular round is tangent and has
a nonzero curvature jump at each plane.

### Integration findings

- In the overlap case, OCCT 7.8.1.1 returned **398.087604366 mm³** after
  cutting first, even though its solid passed the topology check. The
  independent result is **398.086189768 mm³**. Rounding the stock first and
  then cutting in OCCT recovered the reference. SolidCore reached the
  reference with either sequence. The comparison uses round-first for both
  kernels in this case and retains the original cut-first results.
- This profile requires `0 ≤ R < t` to retain a straight side below the
  round. The comparison enforces that domain before accepting a kernel
  result. The report retains how each unguarded kernel handled R = 0.6 mm on
  the 0.5 mm wall.

## Separate STEP AP242 checks

The runner executes the two original [nanocct regression tests](https://github.com/skidzo/nanocct/pull/1)
with the pinned 8.0.1.6 wheel. It feeds their generated AP242 files to the same
pinned SolidCore revision used for geometry.

- **Assembly:** expand four occurrences of a shared 48 mm³ part and compare
  each full world matrix against independently composed poses. The nanocct
  tests separately check local transforms, centroids and inertia.
- **Semantic PMI:** nanocct verifies a 4 mm diameter with +0.10/−0.02 mm
  tolerances and 0.05 mm cylindricity, including their references to the
  intended face. The Rust adapter resolves the same two direct AP242 shape
  aspect links and binds them to the imported face via its original STEP ID.
  This distinguishes the target from the equal-area second cylinder.
  This adapter covers the two fixture types and direct face attachments.
  General native SolidCore PMI decoding and round-trip export remain outside
  the verified path.

These are nominal geometry and interoperability tests. They establish no
manufacturing qualification.

## Run

Use Rust 1.100.0, Python 3.12 and Node.js 24. Run from this directory.

```sh
python3.12 -m venv /tmp/addispec-kernel-venv
/tmp/addispec-kernel-venv/bin/pip install -r requirements.txt

git init /tmp/addispec-nanocct-ap242
git -C /tmp/addispec-nanocct-ap242 fetch --depth 1 https://github.com/skidzo/nanocct.git f5307ac475b440dc3a4940cf0cbed4d6fdc0bfbb
git -C /tmp/addispec-nanocct-ap242 checkout --detach FETCH_HEAD

rustup toolchain install 1.100.0 --profile minimal --target wasm32-wasip1,wasm32-unknown-unknown
export CARGO_BUILD_JOBS=1 CARGO_INCREMENTAL=0 CARGO_PROFILE_DEV_CODEGEN_UNITS=256
cargo +1.100.0 build --locked
cargo +1.100.0 build --locked --target wasm32-wasip1
cargo +1.100.0 check --locked --target wasm32-unknown-unknown

/tmp/addispec-kernel-venv/bin/python compare.py \
  --solidcore target/debug/addispec-kernel-comparison \
  --wasm run-wasi.mjs target/wasm32-wasip1/debug/addispec-kernel-comparison.wasm \
  --nanocct-tests /tmp/addispec-nanocct-ap242/tests/test_ap242_semantics.py \
  --output /tmp/addispec-kernel-evidence
```

The WASI runner executes the geometry cases in Node and compares them with native
SolidCore, using a tolerance of 1e-9 for numeric fields. The browser target is
compile-checked. The report and both generated AP242 files are written to the
output directory. The native suite can also run without the optional `--wasm`
argument.
