# IDTA 02033 — Vormerkungen für die nächste Version

Status: Diskussionspunkte, keine Änderungen am bevorstehenden Veröffentlichungsstand.
Untersuchte Quelle: [Commit 0268784](https://github.com/skidzo/IDTA_submodel_metal_additive_manufacturing/tree/0268784c107a147427591bb63f74d779713eb119), insbesondere definitions/idta02033 und examples/idta-validation. Ein dortiges Review-Artefakt ist nicht automatisch die veröffentlichte Norm.

| Befund im untersuchten Stand | Bedeutung | Vormerkung |
| --- | --- | --- |
| Sechs Submodelle: Machine, BuildCycleSetUp, BuildCycleFabrication, MachineSensor, LayerInformation, ProcessState | Kein eigenständiges ProcessControl-Submodell belegt | Begriffe und Scope für die nächste Version abgleichen |
| Machine enthält ExposureUnit1, LaserSourceRatedPower, LaserPowers, LaserConfiguration | Konfiguration/Nennleistung ist kein zeit- und ortsaufgelöster Ist-Energieeintrag | Soll-/Ist-/Messbezug und Laserzuordnung getrennt prüfen |
| Atmosphere.MainShieldingGasDirection vorhanden | Gasrichtung kann referenziert werden; kein universeller Maschinenframe | Verknüpfung mit dokumentiertem Maschinenkoordinatensystem prüfen |
| Kein vollständiger geprüfter Vertrag für Scanstrategie, Hatch Distance, Scangeschwindigkeit und Inter-Layer-Rotation identifiziert | Keine erfundenen Semantic IDs verwenden | Verbindung zu Vorbereitung und OPC UA / AM-CDM prüfen |
| LayerInformation und PositionZ ersetzen keine vollständige Bauteilplatzierung | 3D-Transformation und Instanzbezug fehlen als bestätigtes Mapping | Referenz auf Vorbereitungsdaten, z. B. 3MF, prüfen |
| CurrentFeedstock ersetzt keine eindeutige Materialcharge | Materialart und Charge getrennt halten | Chargenreferenz und Wiederverwendungskontext prüfen |
| PLC-Bezeichnungen und Semantic-ID-Erzeugung unterscheiden sich zwischen Definitionen, Review-/Publikationsartefakten und Generatorpfaden | IDs dürfen nicht aus Namen geraten werden; PLC1/PLC2 nicht pauschal zusammenlegen | Standübergreifende Konsistenzprüfung für Folgerelease vormerken |
| Kein hier belegter kompletter Vertrag für Kalibrierereignisse und voxel-/zeitbezogene tatsächliche Energieeinträge | Keine Vollständigkeit aus nominalen Parametern ableiten | Separate, datenquellengestützte Erweiterung diskutieren |

Die Informationssammlung [AM-Data-Model-Atlas](https://github.com/skidzo/AM-Data-Model-Atlas) sammelt ergänzende Modelle und Forschungsfragen. Die Vormerkungen begründen keinen Eingriff in das aktuelle IDTA-Release und beanspruchen keine bereits abgestimmte Standarderweiterung.
