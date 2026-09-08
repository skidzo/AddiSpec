# ADR 0001 — Probenidentität, räumliche Angaben und externe Referenzen

Status: von Johannes am 2026-09-08 freigegeben; Umsetzung in PR #1. Kein Mergeauftrag.
Ersetzt keine IDTA-Spezifikation. AddiSpec-Vertrag: Spatial Lineage 0.2.0.

## Problem und Entscheidung

Nominalgeometrie, ein physisches Build-Artefakt, dessen abgeleitete Probe und ein Messbereich sind unterschiedliche Identitäten. Herkunft aus demselben Build beweist keine gleiche Materialeigenschaft. Rückstellproben existieren ohne Prüfauftrag oder Ergebnis; die spätere Untersuchung wird als externe Mess-/Evidenzreferenz ergänzt.

Grobe Angaben sind regulär gültig. Ein Datensatz mit Probenidentität, Build-Referenz und Raumzone braucht keine vollständige Geometrie oder Koordinaten. Die Genauigkeit einer Angabe und die Vollständigkeit des Datensatzes sind unabhängig: eine Raumzone kann sicher berichtet sein, während die genaue Position unbekannt ist. Fehlende Bruchflächen, thermische Historien oder Kalibrierdaten dürfen nicht erfunden werden. Eine Nutzereingabe ist keine Messung.

IDTA liefert standardisierte Semantik; eine konkrete AAS ist eine Instanzrepräsentation. Je Tenant bleibt das deklarierte operative Quellsystem maßgeblich. AddiPlan verknüpft Fertigungsauftrag und Build mit diesen Quellen. Die Vorbereitungssoftware kann weiterhin die maßgebliche Geometrieplatzierung besitzen. AddiBase verantwortet Prüfungen, Auswertung, Evidenz und die fachliche Übertragbarkeitsentscheidung. AddiSpec verantwortet nominale Probendefinitionen, Probenidentität sowie räumlich-materialbezogene Lineage.

Fremde Instanzen werden über stabile, systembezogene IDs referenziert. Kopien sind explizite revisionsgebundene Snapshots mit Provenienz; keine zweite unabhängig editierbare operative Wahrheit. Identität ist das Tupel aus Namespace und Identifikator. Ein Endpoint ist ein Locator, keine Identität. Semantic IDs bezeichnen Bedeutung, keine individuelle Maschine.

## Konkrete Vertragsentscheidungen

1. Systemgrenzen wie oben; tenantabhängige Vorbereitungssoftware bleibt zulässig.
2. Externe Referenzen enthalten System, Namespace, Endpoint oder Repository-URI, Instanz-IDs, für AAS den erwarteten Template-/Semantikstand, Provenienz und Auflösungsstatus. Offline-Validierung prüft den Vertrag und Auflösungsbelege; keine impliziten Netzwerkzugriffe.
3. Numerische Transformation: `p_parent = R * p_child + t`; Basisvektoren sind Spalten von R.
4. Translation in mm; beide Frames mit dokumentiertem Ursprung und Achsen. Rechtshändige orthonormale Basis; Toleranz 1e-6 für Norm, Skalarprodukt und Determinante. Kein angenommener Maschinenursprung.
5. `reported`, `measured`, `computed`, `estimated` bleiben getrennt. Numerische Angaben brauchen Evidenz und Gültigkeitsbereich. Gemessene, berechnete und geschätzte Transformationen brauchen eine Unsicherheitsbeschreibung. `exact` bezeichnet eine nominal exakte Definition, keine physikalisch fehlerfreie Messung.
6. Grobe Kategorien und relative Orientierungsconstraints bleiben unabhängig von absoluten Transformationen.
7. Katalog 0.3.0, Specimen 0.3.0, Quellen 0.2.0, Spatial Lineage 0.2.0; registrierte Schema-Pfade und exakte Versionswerte. Alte Specimen-Schemadatei bleibt unverändert.
8. Explizite Migration mit kontrollierten Metadaten; keine erfundenen Titel, Achsen oder Entry-Klassifikationen.
9. Neue Consumer müssen Versionen prüfen. Historische Daten bleiben über alten Vertrag lesbar; neuer Import verlangt Migration. Keine Behauptung bereits produktiv geprüfter AddiPlan-/AddiBase-Kompatibilität.
10. Xu-Fall aus diesem PR entfernt und separat im Datenmodell-Atlas behandelt.
11. Minimaler Kern: Vertrag, Validator, Migration, Tests und synthetisches Mapping; keine produktiven Adapter, keine Voxel-Datenplattform.
12. Aktueller IDTA-Veröffentlichungsstand bleibt unverändert. Lücken ausschließlich für eine nächste Version dokumentieren.

## Alternative

Ein umfassendes AddiSpec-Modell könnte Maschinen, Builds, Parameter und Messresultate selbst speichern. Das erleichtert autonome Offline-Pakete, erzeugt jedoch konkurrierende Zuständigkeiten und verlangt Synchronisation. Die gewählte Referenzarchitektur reduziert diese Konflikte. Ihre Kosten sind nicht auflösbare Referenzen und externe Versionsabhängigkeiten; Snapshots und explizite Statusangaben erhalten Auswertbarkeit und Transparenz.

## Folgen

Bestehende grobe Erfassung wird unterstützt. Raumzone, Bauorientierung, Prüforientierung und Schliffebene dürfen nicht ineinander umbenannt werden. Erweiterte Ortsauflösung ist anwendungsabhängig, kein Qualitätsurteil über grobe Daten. Die Stellung im Gasstrom kann relevant sein, muss aber für die konkrete Maschine belegt werden.

Siehe [Datenzuständigkeiten](../data-ownership.md), [räumlichen Vertrag](../spatial-contract.md), [Referenzvertrag](../external-references.md) und [Migration](../migration.md).
