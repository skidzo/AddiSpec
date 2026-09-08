# Datenzuständigkeiten

Eine AAS stellt Instanzen mit standardisierter Bedeutung bereit; IDTA selbst ist keine operative Datenbank. Die führende Instanzquelle wird je Integration explizit festgelegt. Die folgende Zuordnung ist AddiSpecs Integrationsvertrag, keine Erweiterung der IDTA-Felder.

| Information | Maßgebliche Quelle | AddiSpec-Repräsentation | IDTA/AAS-Referenz | Darf kopiert werden? | Konsistenzregel |
| --- | --- | --- | --- | --- | --- |
| Machine | Maschinenstamm im deklarierten Quellsystem | externe Referenz | Machine-Submodel und Asset-ID | Snapshot | Nennwerte nicht als Istwerte ausgeben |
| Build | AddiPlan / operatives Build-System | externe Build-Referenz | passender BuildCycle-Instanzbezug, wenn vorhanden | Snapshot | Jobidentität und Revision erhalten |
| Build platform | Betriebsmittelverwaltung | Referenz; optional eigener Frame | konkrete Asset-/Entity-ID, kein erfundener IDTA-Pfad | Snapshot | Plattforminstanz von Bauraumabmessungen trennen |
| Build artifact | operative Fertigungsinstanz; AddiSpec-Lineage-ID | Entity role build-artifact | Instanzreferenz, wenn vorhanden | Identität und Snapshot | Materialartefakt nicht mit STEP-Datei gleichsetzen |
| Part / specimen instance | operative Identität plus AddiSpec-Probenidentität | Entity mit optionaler usage retained | Asset-/Entity-ID | Referenz | Rückstellprobe benötigt kein Messergebnis |
| Layer | Maschinen-/Build-Daten | externe Referenz | LayerInformation, konkreter Instanzpfad | Snapshot | Layernummer nur innerhalb des Builds eindeutig |
| LaserUnit | Maschinenkonfiguration | externe laser-unit-Referenz | beobachtetes ExposureUnit-Element | Snapshot | Nicht automatisch auf jedes Voxel übertragen |
| Scan strategy | Build-Vorbereitung / Steuerung | Referenz | kein vollständiges Mapping im untersuchten IDTA-Stand belegt | Snapshot | Plan, Steuerungsauftrag und Ausführung unterscheiden |
| Process parameters | Vorbereitung / Steuerung / Messsystem nach Wertart | Referenz | nur tatsächlich vorhandene Felder | Snapshot | Sollwert, berichtet, gemessen, berechnet trennen |
| Material batch | Chargenverwaltung / AddiPlan | material-batch-Referenz | konkrete Chargen-ID; CurrentFeedstock allein reicht nicht | Snapshot | Materialbezeichnung ist keine Charge |
| Nominal geometry | kontrollierte AddiSpec-Definition oder CAD-Quelle | Specimen-Definition, Hash, Referenz | optionale Dokument-/Entity-Referenz | kontrolliertes Artefakt | Hash beweist Dateiidentität, keine Fertigungsidentität |
| Build placement | jeweilige Vorbereitungssoftware | Kategorie, Constraint oder belegte Transformation | externe placement-Referenz | belegte Beobachtung / Snapshot | Kein Zonenmittelpunkt aus grober Zone |
| Specimen extraction | dokumentierter Entnahmevorgang | extracted-from / sectioned-from | externes Ereignis bei Bedarf | eigene Lineage mit Evidenz | Keine Position aus Skizzen rekonstruieren |
| Prepared sample | Probenpräparation / AddiSpec-Lineage | prepared-sample und prepared-from | externe Instanz bei Bedarf | eigene Lineage | Präparation kann Orientierung/Geometrie ändern |
| Measurement region | Messsystem / AddiBase | measurementRegions mit Evidenz | externe measurement-Referenz | belegte Region | Fläche ist kein separates Bruchartefakt |
| Qualification evidence | AddiBase / verantwortliche Qualifikationsstelle | qualification-Referenz | externe Evidenz-/Dokument-ID | revisionsfester Snapshot | Gemeinsamer Build ist kein Qualifikationsnachweis |
| Storage / heating / calibration | jeweiliges Ereignis- oder Messsystem | externe Referenz | nur vorhandene Instanzen | Snapshot | Ereigniszeit von Erfassungs- und Auflösungszeit trennen |

Für Snapshots gelten Zeit, Revision, Hash und Provenienz aus dem [Referenzvertrag](external-references.md).
