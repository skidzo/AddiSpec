# FDM and SLS dimensional witness pilot

Print three coupons in one FDM build and three in one SLS build. Use the same
nominal geometry and inspect all six with the same method. This is a screening
comparison of two production routes, including their materials, machines and
settings. Three parts from one build per route provide a view of within-build
variation only.

## Build request

| Route | Quantity | Proposed material | STEP file |
| --- | ---: | --- | --- |
| FDM | 3 | ABS-M30 | [Download FDM STEP](../../../specimens/mex/dimensional-witness/ADDISPEC-FFF-DIMENSIONAL-WITNESS-30/geometry/ADDISPEC-FFF-DIMENSIONAL-WITNESS-30.step) |
| SLS | 3 | Unfilled PA12 | [Download SLS STEP](../../../specimens/pbf-p/dimensional-witness/ADDISPEC-PBFP-DIMENSIONAL-WITNESS-30/geometry/ADDISPEC-PBFP-DIMENSIONAL-WITNESS-30.step) |

Confirm the machine and actual material grade before printing. Use SLS for the
powder route. Both STEP files represent revision 1 of the same nominal design.
Use each route's STEP and record its SHA-256 from the
[FDM](../../../specimens/mex/dimensional-witness/ADDISPEC-FFF-DIMENSIONAL-WITNESS-30/specimen.json)
or [SLS](../../../specimens/pbf-p/dimensional-witness/ADDISPEC-PBFP-DIMENSIONAL-WITNESS-30/specimen.json)
specimen record.

- Request a flat orientation with the coupon's design +Z aligned to build +Z,
  and its long edge aligned to build X where feasible. Record the actual
  orientation and position for each coupon. A reported build zone is acceptable
  if exact coordinates are unavailable.
- Use normal production settings and record available settings or the recipe
  revision. Keep the supplied nominal geometry and document any process
  compensation applied during build preparation.
- Allow standard FDM support removal and SLS depowdering. Record the method.
  Exclude machining, hole reaming and cosmetic finishing for this comparison.
- Use a separate labelled bag for each coupon to preserve identity without
  putting a mark on the measurement surfaces.

Use the [AM machine register](../../../machines/README.md) to check available
local job transfer and export before agreeing the pilot data exchange.

Enter the build metadata in [builds.csv](builds.csv). Link coupons using
`pilot_build_key`. Use `not-reported` for unavailable metadata and leave
unmeasured numeric values blank with a reason in `notes`.

## Inspection

Measure in one lab, ideally with one operator and the same instruments. After
cleaning, condition the coupons together for at least 24 h in that room and
record actual duration, temperature and relative humidity. Record gauge
identity, resolution and any available measurement uncertainty.

| Feature | Nominal | Where and how to measure |
| --- | ---: | --- |
| Length X | 30 mm | End to end along the base, at mid-width Y |
| Width Y | 15 mm | At X near 15 mm, across the two sides of the base |
| Base thickness | 3 mm | Lower terrace near X = 15 mm and Y = 7.5 mm, measured from the underside |
| Overall height | 5 mm | Raised terrace near X = 5 mm and Y = 7.5 mm, measured from the underside |
| Through-hole | 4 mm | Record the largest calibrated pin that passes fully without force and the next attempted pin that fails. Record pin sizes and test direction. |

Inspect all five features on every coupon. Record dimensional readings and the
two pin sizes in [measurements.csv](measurements.csv). If a pin bound is
unavailable, leave that bound blank and record why. The passing and failing pin
sizes bracket functional clearance under this method. They do not establish
circularity or a fitted diameter.

Report measured minus nominal for the four linear dimensions, then give
individual values, median and range by route. Report hole clearance brackets
and observations separately. Record build and inspection evidence alongside
the summary. If a job export is available, link its revision or checksum as
planned build instructions. Record any available machine observations
separately. Retain the distinction between a comparison of these two builds
and a claim about the processes in general.
