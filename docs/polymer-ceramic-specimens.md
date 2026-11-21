# Polymer and ceramic starter specimens

Four polymer entries use the same 30 × 15 mm footprint, a 3 mm base, a 5 mm
overall step height and a 4 mm through-hole. The shared geometry lets a service
bureau compare the same measurable features across different manufacturing
routes. Compare the inspection stage, build orientation, placement and
measurement method alongside the dimensions.

| Catalogue process | Candidate material and route | Capture for a physical comparison |
| --- | --- | --- |
| MEX | Thermoplastic filament, FFF/FDM | Build orientation, raster direction, bead width, infill, layer height, filament lot and conditioning |
| PBF-P | Polymer powder, SLS or SAF | Actual route, packing position, powder reuse or refresh, cooldown and finishing |
| VPP | Photopolymer resin, SLA or DLP | Actual route, exposure settings, supports, washing and post-cure |
| MJT | Jettable photopolymer, e.g. PolyJet | Print mode, head direction, model and support materials, and support removal |
| VPP | Alumina suspension, ceramic vat photopolymerization | Build orientation, green and fired dimensions, thermal processing and any applied compensation |

Process and material are independent. The specimen's `design.materialIntent`
identifies the candidate material and feedstock form. Record the actual grade,
batch and process variant with the build. `PBF-P` is the catalogue label for
polymer powder bed fusion. See [ISO/ASTM 52900:2021](https://www.iso.org/standard/74514.html)
for AM vocabulary.

## Ceramic measurement stages

The alumina bar STEP represents the **30 × 8 × 4 mm final sintered
target**. The pilot needs separate measurements of the green and sintered
states for the same specimen, with a debound measurement where available.
Record the X, Y and Z dimensions in the specimen frame and retain the
orientation that relates it to the build. Calculate green-to-sintered linear
shrinkage per axis as `(green − sintered) / green`. Report final dimensional
deviation against the STEP separately. Green geometry and compensation depend
on the feedstock, process and thermal cycle and must be supplied for each build
where applicable. See [Alves et al. on alumina debinding and sintering](https://doi.org/10.1016/j.ceramint.2024.12.336).

## Comparing physical builds

Start with a repeat of the polymer witness in one process, then run the same
inspection on a second process. Keep build and specimen IDs, geometry revision,
material lot, orientation, post-processing state, method and uncertainty with
each result. Record the overall dimensions, step height and hole diameter.
Archive available build instructions separately from observations of the
executed run. IDTA 02033 references apply to the metal PBF-LB/M work. Polymer
and ceramic records can use the generic external-reference contract for build
and inspection records.

These are digitally checked exploratory templates. The initial set has no
measured build results, acceptance thresholds or manufacturing qualification.

## Verify or re-export nominal geometry

With CadQuery 2.7.0 available, run:

```sh
python scripts/check-multi-process-geometry.py
```

The script reads dimension parameters from each specimen record, re-imports
the tracked STEP and checks that a valid solid matches the parametric body.
Use `--export-to DIRECTORY` to generate separate STEP files. Fresh exports
may carry different STEP header metadata. The tracked files and their recorded
SHA-256 digests identify the reviewed exchange artifacts.
