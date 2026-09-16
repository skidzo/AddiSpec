# Four initial PBF-LB/M reference cases

This is the first digital stage of the four-case benchmark selected by Johannes:
density cube, thin wall, corrected overhang, and a common round tensile specimen.

The runnable baseline generates nominal calculation geometry, reimports its STEP
export and generates two second-order volume meshes per case. It does not solve
FEA, reconstruct a physical build, or provide measured validation data.

| Case | Geometry | Primary future comparison |
| --- | --- | --- |
| Density cube | 10 x 10 x 10 mm | Thermal history, dimensions and independently measured density |
| Thin wall | 40 x 0.5 x 20 mm | Out-of-plane deformation and temperature history |
| Corrected overhang | 40 x 10 x 20 mm envelope; one 45-degree downskin | Downskin deviation, surface measurement and release distortion |
| Round tensile | d0 = 5 mm; L0 = 25 mm; parallel length = 30 mm | Force-extension curve over the gauge, strain uniformity and material response |

## Tensile selection and limits

A 5 mm round gauge with 25 mm original gauge length is documented in the
[EOS MS1 M400 material data sheet, June 2022, page 4 footnote 8](https://uk.eos.info/03_system-related-assets/material-related-contents/metal-materials-and-examples/metal-material-datasheet/werkzeugstahl_ms1_cx/ms1/ms-ms1-m400_material_data_sheet_06-22_en.pdf).
This is evidence of established metallic-AM use. We have no evidence that one
specimen is the most common worldwide. The test-method target is
[ISO 6892-1:2019](https://www.iso.org/standard/78322.html). The cited EOS document
describes an older test-method edition; it is used here only to establish the
gauge dimensions, not to establish current conformance.

The generated numerical specimen has a 30 mm parallel section and central gauge
marks at z = -12.5 and +12.5 mm. L0 and parallel length are distinct quantities.
Each shoulder uses two tangent radius-6 mm circular arcs, joining the 5 mm gauge
to a smooth 10 mm diameter, 10 mm long cylindrical grip at each end. The overall
length is approximately 64.662878 mm. These additional dimensions and the
S-shaped shoulder are authored engineering choices, not dimensions attributed to
the EOS source or a DIN drawing.

The numerical profile is deliberately identified as an engineering reference.
It is not a DIN 50125 type-B manufacturing drawing: no threaded grips are
represented, no dimensional or surface tolerances are released, and laboratory
grip compatibility is unconfirmed. A controlled final drawing and review of the
applicable standard are required before machining a test specimen. Future
thread/contact submodels can be attached when the gripping mechanism matters.

The existing 12 x 70 mm round blank remains the nominal manufacturing input. A
centered placement of the numerical specimen leaves 1 mm nominal radial stock at
the grips and approximately 2.668561 mm at each end. This is only envelope
containment; it does not account for distortion, support removal, setup, clamping
stock or machining tolerances. The proposed extraction is not a recorded physical
operation. Its frame must be retained when mapping residual stress or material
orientation from the blank into the finished specimen.

## Geometry and coordinate contract

The manifest is a benchmark contract, separate from catalog/specimen 0.3.0 and
spatial-lineage 0.2.0. Its sourceCommit identifies the inspected source STEP
revision. Every source is additionally pinned by path, bytes and SHA-256.
Changes to an input require explicit review and a manifest update.

Transforms use the repository convention: p_model = R * p_source + t, with the
three basis vectors forming the columns of R and translation in mm. These are
exact nominal calculation frames; they do not assert machine placement.

The cube is translated by [5, 5, 0] mm, and the thin wall by [20, 0.25, 0] mm, to
center their footprints. Their nominal growth direction remains +Z.

The overhang STEP is stored as an XY trapezoid extruded along Z. Its former +Z
growth direction made the diagonal a vertical side wall. The corrected
source-local growth direction is -Y. Applying
p_model = [x_source, z_source, -y_source + 10] produces a +Z build domain:

- Bottom footprint: x = 0 to 20 mm, y = 0 to 10 mm, z = 0.
- Top footprint: x = -20 to 20 mm, y = 0 to 10 mm, z = 20 mm.
- Inclined outward normal: [-1/sqrt(2), 0, -1/sqrt(2)].
- Inclined plane angle to the horizontal build plane: 45 degrees.
- Volume: 6000 mm3.

The source STEP and its historical geometry evidence remain unchanged; the
specimen metadata now declares -Y and points to its evidence. The generator
exports the corrected calculation geometry as a separate STEP artifact, with its
own hash. Consumers that assumed every source had +Z growth must use the declared
direction and transform. A base/support assembly is a separate model input.

For tensile, the generated model is centered at z = 0 and its loading axis is +Z.
The proposed mapping into the original blank adds [0, 0, 35] mm. Geometry
axisymmetry does not imply isotropic material or an axisymmetric build history.

## Run

Python 3 and the pinned Gmsh package are needed. On Ubuntu, the Gmsh wheel also
requires libGLU (libglu1-mesa).

Run from the repository root:

~~~bash
python3 -m venv /tmp/addispec-mesh-venv
/tmp/addispec-mesh-venv/bin/pip install -r benchmarks/pbf-lbm/core-four/requirements.txt
/tmp/addispec-mesh-venv/bin/python benchmarks/pbf-lbm/core-four/validate.py --output /tmp/addispec-core-four-run
~~~

The output directory must not already exist, so a prior evidence package is not
overwritten. GitHub Actions runs this baseline and retains the generated
model.step files, meshes and report.json as a workflow artifact.

The report records the generator and manifest hashes, Gmsh version, geometry
checks, region tags, mesh counts, Jacobians, signed quality, volume errors and
artifact hashes. Export timestamps may change file bytes between runs; geometric
equivalence and per-run file identity are separate checks.

## What the executable gate establishes

- The controlled input still matches its specimen and evidence hashes.
- Import/generation produces one solid domain with the intended bounds and volume.
- The generated STEP can be reimported and passes the same geometry checks.
- The overhang has a genuinely downward inclined face in the calculation frame.
- The tensile reference has the intended gauge cylinder and fits within the nominal blank.
- Both mesh levels contain second-order volume elements with positive minimum
  Jacobians, positive signed quality and less than 1% volume error.
- The thin wall uses structured hexahedra with 4 and 8 elements through thickness.
- The fine level contains more elements than the coarse level.

These are import, geometry-function and mesh checks. They do not constitute a
full independent B-rep validity analysis, FEA convergence or physical validation.
Positive element quality is a minimum numerical gate, not proof of accuracy.
The reported minimum signed quality supports further solver-specific review.

The cube, overhang and tensile reference use tetrahedral meshes for this initial
gate. The thin wall uses structured hexahedra because its small thickness needs
explicit control. Production analyses can use different discretizations with
their own evidence. See the [Gmsh manual](https://gmsh.info/doc/texinfo/gmsh.html).

## Next evidence for each case

| Case | Required simulation definition | Required manufacturing/measurement record |
| --- | --- | --- |
| Density cube | Thermal properties, energy input, activation, powder/base heat transfer and measurement regions | Material lot, machine/parameters, build position, preparation, measured density and uncertainty |
| Thin wall | Base restraint, thermal gradients, release sequence; shell/solid and mesh/time-step comparisons for selected outputs | Attachment/removal route, wall thickness and out-of-plane scan before and after release |
| Corrected overhang | Explicit support or unsupported-powder treatment, downskin region and actual placement | Build strategy, downskin scan/roughness with measurement settings and uncertainty |
| Tensile | Final controlled geometry, grip/loading conditions, extensometer definition and a justified material model; blank-to-specimen state transfer where relevant | Blank history, machining/heat treatment, drawing/tolerances, alignment, actual dimensions and test curve |

For each analysis, define outputs and acceptance criteria before calibration.
Verify force/energy balance where applicable and converge the selected quantities
over mesh and time step. Do not use a singular peak stress as a convergence
target. Keep calibration observations separate from independent validation
observations. A transient melt-scale model and a calibrated part-scale distortion
model require different resolutions and inputs.

AddiSpec owns nominal definitions and lineage. AddiPlan or the declared build
preparation system owns the manufacturing instance and placement. AddiBase owns
measurement evidence and the transferability decision. This benchmark adds no
second operational source of truth and no fabricated material properties or
measurements.
