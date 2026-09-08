# Synthetische Rückstellprobe und AAS-Referenz

Dieses Beispiel ist vollständig synthetisch und enthält keine realen Produktionsdaten. Es illustriert den minimalen Fall: eine mitgedruckte Rückstellprobe, grobe Raumzone, Orientierungskategorie, Build-Bezug und Maschinenreferenz. Es gibt noch keine Laboruntersuchung und keine bekannte metrische Platzierung.

## Mapping

| AddiSpec-Angabe | Bedeutung / Ziel | Kopierte Werte |
| --- | --- | --- |
| retained-coupon | physisches Build-Artefakt, usage retained | eigene synthetische Identität |
| machine-ref | synthetische AAS-Instanz; Asset- und Submodel-ID | keine Maschinenparameter |
| expectedModel | Machine-Template und Semantic ID aus dem unten genannten Review-Artefakt | nur Modellidentifikatoren |
| build-ref | synthetische operative Build-ID in AddiPlan | keine Prozessparameter |
| U-LH | im Beispielvokabular unten / links / hinten | quellengebundene Kategorie |
| standing | im Beispielvokabular stehende Bauorientierung | keine Rotationsmatrix |

Vocabulary urn:addispec:example:build-zones bezeichnet die acht Kombinationen U/O (unten/oben), L/R (links/rechts), H/V (hinten/vorne). Die Zonengrenzen und Maschinenachsen sind nicht metrisch definiert. Vocabulary urn:addispec:example:orientation-categories enthält lying, fortyfive und standing als Kategorien. Die Quellenkonvention muss vor einer metrischen Umrechnung zusätzlich bekannt sein.

## Nachprüfbare IDTA-Quelle

[Machine-Review-AASX bei Commit 0268784c107a147427591bb63f74d779713eb119](https://github.com/skidzo/IDTA_submodel_metal_additive_manufacturing/blob/0268784c107a147427591bb63f74d779713eb119/examples/idta-validation/IDTA%2002033-1-0_Template_Machine.aasx), Inhalt aasx/data.json:

- Submodel.id: https://admin-shell.io/idta/SubmodelTemplate/Machine/1/0
- Submodel.semanticId.keys[0].value: https://admin-shell.io/idta/cds/Machine/1
- administration.version = 1, administration.revision = 0

Die Template-ID wird nicht als Maschineninstanz ausgegeben. Alle Instanz-IDs unter urn:addispec:example und alle Endpoints unter example.invalid sind Platzhalter. resolution.status ist not-attempted. Es erfolgt kein Netzabruf, keine AAS-Konformitätsbehauptung und kein Mapping erfundener Prozessfelder.

Ein späteres Laborergebnis kann über eine externe measurement-/qualification-Referenz ergänzt werden. Vorbereitung oder Entnahme erzeugt eine eigene Entity und eine belegte derivation. Die fachliche Übertragbarkeit auf ein Bauteil ist eine separate Bewertung.
