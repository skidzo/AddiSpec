# PBF-LB/M machine integration and specimen evidence

**Status:** Draft integration profile for review. The CAD-to-AAS demonstration exercised a simulated machine over local OPC UA. The physical acceptance cases below require a target machine and inspection evidence.

## Responsibilities and interfaces

| Owner | Output or obligation |
| --- | --- |
| CAD/AddiSpec | Exact geometry, part revision, specimen template and source evidence |
| CAM | Part occurrences and planned poses, controlled build package and profile version |
| AddiPlan | Order, intended revision and target machine, plus the recorded admission response |
| Machine | Local preparation, operator release, run identity, process control and durable events |
| AddiBase | Readout, source quality and timestamps, artifact evidence and explicit data gaps |
| Inspection | Identifiable recovered samples, derivations, measured results and uncertainty |

Start with approved local readout and a machine-native job prepared through its established route. When evaluating an open CAM route, compare a generated job against a reference accepted by the exact importer version before any physical run. Record the accepted job identity, and bind the machine result to that identity. The reAM250 publication documents AMCF, PLC and scanner integration with a Netfabb-generated input. It does not establish support for the current 3MF Toolpath Extension. [reAM250](https://wlt.de/sites/default/files/2023-09/Contribution_283.pdf) · [3MF Toolpath](https://3mf.io/announcement/2026/11/toolpath-intro/)

## Draft AddiSpec evidence profile

Use the existing [spatial contract](../../spatial-contract.md) for occurrence, placement and physical derivations. Use the [external reference contract](../../external-references.md) for resolved or unresolved references to machine records and AAS. Use actual artifact and element identifiers. The terms in this table describe evidence roles for a future interoperability profile.

| Evidence role | Content and identity rule |
| --- | --- |
| Nominal design | Template ID, revision, exact geometry digest |
| Planned occurrence | One persistent occurrence ID per placement, build package revision and frame transform where available |
| Accepted plan | Target machine, machine-issued job ID/revision, acceptance response and digest for the artifact version actually reported |
| Fabricated artifact | Run identity, occurrence link, as-built observation and traceable material-lot reference when available |
| Derived sample | Distinct identity and derivation from the physical parent. Record known cutting plane or explicitly record the gap. |
| Inspection result | Sample/region, method, result, unit, uncertainty and artifact or result reference where available |

Use existing AddiSpec identifiers and verified reference resolution. An absent lot, pose or source digest stays unknown. A measured pose has its own provenance and uncertainty. Plan, machine-reported execution and inspection evidence answer different questions. CAD hash equality can coexist with different material histories. Simulated jobs may exercise references and transformations. Release and manufacturing qualification need physical evidence.

## Acceptance cases

1. Use one order and one geometry revision with two identifiable occurrences. Verify that the two placements resolve independently despite a shared STEP digest.
2. Record a first aborted attempt and a distinct second run. Both link to the accepted revision. A repeated submission with the same request identity must not produce a duplicate job.
3. During an operator-approved test, interrupt only the data collector link. Verify replay or record the unresolved gap. Distinguish a completed layer counter from geometrical cut height and confirm the numbering convention.
4. Preserve both sample identities through removal and measurement. Resolve a selected result back to its sample, physical parent, run, placement and source artifacts. Record any missing links explicitly.
5. Compare AAS snapshots with machine records for Machine, Build Cycle Set Up, Build Cycle Fabrication, Machine Sensor, Layer Information and Process State. Validate actual semantic identifiers against the instantiated template revision.

An OEM pilot should capture exact installed versions, approved access role and supported exports in the [machine register](../../../machines/README.md). For a research platform, additionally record the job importer profile, local run log, and observed driver and proprietary dependencies.
