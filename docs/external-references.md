# Referenzvertrag 0.2.0

externalReferences steht im Spatial-Lineage-Record. Das [Einzelschema](../schemas/0.2.0/external-reference.schema.json) entspricht dem eingebetteten Strukturschema; semantische Prüfungen erfolgen zusätzlich durch scripts/lib/spatial.mjs.

- id: recordlokaler Referenzname; Entities verwenden externalReferenceRefs.
- system: zuständiges System; namespace: stabile URI zur Trennung der Identitätsräume, auch zwischen Tenants.
- endpoint: URI des Repositorys oder Dienstes. Sie ist ein Locator und darf sich ohne Identitätsänderung ändern.
- kind: aas oder external; relation beschreibt die Funktion des Ziels.
- identifiers: assetId, submodelId, entityId und optional elementPath. Mindestens eine Instanz-ID; AAS benötigt submodelId. Elementpfade enthalten tatsächliche idShort-Segmente und benötigen eine Submodel-ID. Nicht aus Semantic IDs konstruieren.
- expectedModel bei AAS: templateId, version, revision, semanticId und sourceRevision. Der festgehaltene Modellstand stammt aus dem tatsächlich verwendeten Artefakt.
- provenance: Quellenregister-ID, Locator und Wissensstatus; bei Messung, Berechnung oder Schätzung zusätzlich Methode.
- resolution: not-attempted, resolved oder unresolved. Ein Auflösungsversuch hat checkedAt mit Zeitzone. unresolved verlangt reason und verbietet eine Erfolgsmeldung target. resolved verlangt einen Zielbeleg mit denselben angefragten IDs sowie passender Semantik/Version.
- snapshot optional: relativer Dateipfad innerhalb des Record-Verzeichnisses, Bytezahl, SHA-256, capturedAt mit Zeitzone, Revision und Evidenz. Symlink-Ausbrüche werden abgelehnt.

## Auflösung und Konsistenz

Die Validierung ist offline und prüft aufgezeichnete Belege. Sie beweist keine aktuelle Erreichbarkeit oder Authentizität eines AAS-Servers. Ein produktiver Adapter muss IDs und Modellstand beim Lesen auflösen, den Prüfzeitpunkt festhalten und Abweichungen als unresolved dokumentieren; dies ist ein späterer Integrationsschritt. Ein nicht auflösbares Ziel macht den Record nicht ungültig. Das Ziel darf nicht als verifiziert in eine davon abhängige Auswertung eingehen.

Snapshots sind revisionsgebundene Quellenkopien, keine unabhängig bearbeitbaren Stammdaten. Hashprüfung sichert Bytes; sie beweist nicht die fachliche Richtigkeit des Inhalts. Neue Auflösung oder geänderte Quelle erzeugt eine neue Record-Revision mit neuem Beleg. Alte Snapshots nicht überschreiben. Snapshot- und Auflösungszeit sind getrennt von Fertigungs-, Mess- und Ereigniszeit.

Maschinenparameter, Sollwerte, Messwerte und tatsächlicher Energieeintrag dürfen nicht stillschweigend gleichgesetzt werden. Das freie reportedContext-Objekt wurde entfernt, damit es kein zweites ungeprüftes Prozessmodell bildet.
