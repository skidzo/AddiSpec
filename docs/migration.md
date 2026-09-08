# Versionierung und Migration

| Dokument | Historischer Stand | Neuer Vertrag |
| --- | --- | --- |
| catalog.json | 0.2.0, 18 indexierte Templates | 0.3.0, entryKind, getrennte Zähler; Repository ergänzt den vorhandenen experimentellen Record als 19. Eintrag |
| specimen.json | 0.1.0 und 0.2.0, breites altes Schema | 0.3.0, strikt; $schema, title, design.coordinateSystem erforderlich |
| sources.json | 0.1.0 auf main | 0.2.0, explizites Schema |
| spatial-lineage.json | unveröffentlichter PR-Entwurf 0.1.0 | 0.2.0; Referenzvertrag und präzisierte räumliche Semantik |

0.x-Minorversionen können brechen. Keine Rückwärtskompatibilitätsbehauptung, kein 1.0-Stabilitätsversprechen. Consumer müssen Version und Dokumentart vor dem Interpretieren prüfen. Unbekannte Versionen werden abgelehnt. Das alte schemas/specimen.schema.json bleibt bytegleich zu main vor PR #1; aktuelle Schemas liegen in versionierten Verzeichnissen. Alte, nur auf Regex beruhende Versionsangaben waren keine technisch durchgesetzte Kompatibilitätsgarantie.

## Mechanische Migration

```bash
node scripts/migrate-document.mjs specimen old-specimen.json reviewed-metadata.json new-specimen.json
node scripts/migrate-document.mjs catalog old-catalog.json reviewed-kinds.json new-catalog.json
```

Das Ziel darf noch nicht existieren. Eingaben werden nicht überschrieben; unbekannte Felder werden nicht entfernt. Fehlermeldungen nennen erforderliche Nacharbeit.

Specimen-Metadaten bei fehlenden Feldern:

```json
{"title":"Fachlich geprüfter Titel","coordinateSystem":"not-reported"}
```

not-reported ist eine ausdrückliche Wissensangabe, kein Koordinatensystem für Berechnungen. Wenn eine Quellkonvention bekannt ist, wird deren Beschreibung eingetragen. Das Skript setzt dies nicht selbst.

Katalog-Metadaten:

```json
{"entryKinds":{"EXAMPLE-ID":"template","EXPERIMENT-ID":"experimental-record"}}
```

Jeder vorhandene Eintrag benötigt eine geprüfte Klassifikation. Die generische Migration erhält genau die alten Einträge; sie erfindet keinen fehlenden experimentellen Record. Der bestehende Repository-Katalog wurde explizit um den bereits vorhandenen Record ergänzt. Dieser Unterschied wird in Tests abgesichert.

Die 19 vorhandenen Specimen-Dokumente enthalten bereits Titel und Koordinatensystembeschreibung. Historisch tragen 18 Templates bereits 0.2.0 und der experimentelle Record 0.1.0, beide unter dem alten breiten Schema. Deshalb ist der neue strikte Specimen-Vertrag 0.3.0. Bei ihnen ändern sich nur schemaVersion und $schema; Geometrie, Hashes und fachliche Werte bleiben erhalten. Quellenmigration: neuen registrierten $schema-Pfad und 0.2.0 setzen, Felder gegen das Schema prüfen. Für alte Spatial-Lineage-Entwürfe ist eine fachliche Migration nötig: reportedContext in Referenzen/Snapshots überführen, Frame-Konvention, Richtung, Evidenz und Unsicherheit prüfen. Keine automatische Deutung alter numerischer Transformationen.

## Zusätzliche Felder und Consumer

Neue Vertragsobjekte sind an ihren definierten Grenzen geschlossen. Bereits dokumentierte offene Specimen-Unterobjekte (z. B. lifecycle und materialIntent) bleiben offen und sind kein Kanal für eine zweite operative Wahrheit. Alte beliebige Zusatzfelder können unter dem neuen Schema scheitern. Sie bleiben im Original erhalten; eine geprüfte Projektion oder spätere versionierte Erweiterung ist erforderlich.

Ein alter Consumer ohne Versionsprüfung kann neue Felder ignorieren oder falsch deuten; die neuen Versionsnummern beheben dessen Implementierung nicht. Vor dessen Umstellung sind explizite Versionsprüfung und die hier beschriebenen Vertragstests erforderlich.

Das bestehende mappings/addibase-aas.json beim experimentellen NuCOS-Record bleibt eine historische Projektion mit modelType „proposal“, keine AAS-Serialisierung und kein produktiver Consumer-Vertrag. Die neue Integration wird am synthetischen Referenzbeispiel beschrieben.

AddiPlan und AddiBase werden in diesem PR nicht produktiv umgestellt. Ihre künftigen Adapter müssen template und experimental-record unterscheiden, Versionen erkennen, Unsicherheit erhalten und not-attempted/unresolved weiterreichen. Die Tests sind Consumer-Vertragstests für Daten, keine Ende-zu-Ende-Zertifizierung laufender Systeme. Ein Consumer kann den alten Vertrag weiter lesen; beim neuen Import gilt Migration statt stiller Defaults.

## Prüfung

```bash
node --test scripts/*.test.mjs
node scripts/validate-library.mjs
git diff --check
```

Node 22 und 24 werden in CI geprüft, ohne Paketinstallation. Actions sind per Commit fixiert und haben contents: read.
