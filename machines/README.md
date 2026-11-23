# AM machine register for controlled data exchange

This register records evidence for a defined job or data workflow on a specific
machine model. Use it to select a candidate, then verify the delivered
hardware, firmware, software, licence and deployment. The [machine-readable
register](catalog.json) records the evidence scope, source links and open
questions for each model.

| Machine | Process | Candidate workflow | Evidence status |
| --- | --- | --- | --- |
| Stratasys F770 | MEX · FDM | GrabCAD Print Offline Mode and local job submission. Confirm the installed licence and local job-history export. | Vendor-documented workflow |
| Prusa CORE One L+ INDX 4-Tool | MEX · FFF | Prepare and transfer print files offline using local PrusaSlicer and USB media. Capture execution evidence on site. | Vendor-documented workflow |
| Formlabs Fuse 1+ 30W | PBF-P · SLS | Upload jobs directly from PreForm via USB. Verify commissioning and offline access to job results separately. | Vendor-documented job transfer |
| Nexa3D QLS 230 | PBF-P · SLS | Confirm local job submission, report export and ongoing support with the operator. | Workflow needs confirmation |
| EOS M 290 | PBF-LB/M | Evaluate local read access to historical and quality data through EOSCONNECT Core. Confirm version, licence, trust and access controls. | Vendor-documented data interface |

**Evidence boundary.** The initial entries are based on public material.
Product cybersecurity certification and on-site verification are unconfirmed.
Evidence for printing, data readout, provisioning, and maintenance is assessed
separately. A working local print path does not establish a local readout path.
Where a certificate is available, record the issuer, reference, scope and
covered product version. An organization-level or cloud-service certificate
does not establish assurance for the installed printer. See the [ISASecure
overview](https://www.isasecure.org/hubfs/ISASecure%20Quick%20Start%20Guide%202023_WEB.pdf?hsLang=en).

## Verify the workflow on the installed machine

1. Ask the operator for the model and controller, supported firmware, job
   preparation software and licence, approved transfer method, local export
   formats, and dependencies for commissioning, normal operation, updates and
   remote support. Confirm what the supplier is willing to share.
2. In an operator-approved isolated setup, run a non-sensitive coupon through
   the intended workflow. Verify job transfer, execution and whatever local
   reporting the workflow requires. Use a managed transfer station for removable
   media, or a restricted local network with approved traffic only. For a data
   integration, verify the read-only role, validated machine identity and
   encrypted transport where required. Record the observed network behavior and
   any functions that fail without Internet access.
3. Record the result against the exact installed versions and configuration.
   Link the build ID, design revision, received or submitted artifact digest
   where available, provenance of the run evidence, and inspection record.
   Store raw proprietary jobs, logs and site details in the approved location.
   Recheck the affected workflow after changes to firmware, connectivity,
   licences or support arrangements.

For the [FDM/SLS pilot](../docs/pilots/fdm-sls/README.md), use the F770 as a
documented FDM candidate and ask which SLS machine the operator would run.
The QLS 230 is a supplier-listed PA12 candidate and the Fuse 1+ 30W is a
reference for a documented direct-USB job path. A supplier-provided build
record can support the pilot even when native logs are unavailable. Keep the
source explicit and preserve any gap in execution evidence.

AddiSpec keeps the design and specimen identities. Link controlled build
records and inspection results using its [reference contract](../docs/external-references.md).
IDTA 02033 can supply machine and build context for the metal PBF-LB/M entry.
