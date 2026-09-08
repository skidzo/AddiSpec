# Räumlicher Vertrag 0.2.0

## Wissensstand und minimale Erfassung

Spatial-Lineage-Entities benötigen Identität, Scope und Rolle. Geometrie, Frame, Messregion und Prüfergebnis sind optional. Ein leeres coordinateFrames-Array ist gültig. Die Pflichtarrays dokumentieren die Struktur, nicht die Vollständigkeit des Wissens.

placementObservations erfassen unveränderte Kategorien mit Vocabulary-URI und Evidenz. build-zone, build-orientation, test-orientation und section-plane sind verschiedene Sachverhalte. Ein Vocabulary muss im Quellsystem oder der Begleitdokumentation erklärt werden; der Validator löst es nicht online auf. Ohne dokumentierte Achsenkonvention darf eine Kategorie nicht in einen absoluten Winkel oder Punkt umgerechnet werden. Fehlende Angaben werden weggelassen und bei Bedarf unter evidenceGaps erläutert.

## Frames und Transformationen

Frame-IDs sind im Record eindeutig; globale Identität ist Record-ID plus Frame-ID. parentFrameRef ist optional. Ein Root verwendet not-applicable. Ein bekannter Parent ohne bekannte numerische Beziehung verwendet not-reported. Frame- und Ableitungsgraphen müssen azyklisch sein.

Für numerische Transformationen gilt:

```text
p_parent = R * p_child + translationMm
R = [ basis.x | basis.y | basis.z ]   (Spalten)
```

Die Translation ist der Ursprung des Kind-Frames, ausgedrückt im Parent-Frame in Millimetern. Punkte werden als Spaltenvektoren aufgefasst. R ist dimensionslos, orthonormal und rechtshändig. Zulässige numerische Abweichung: 1e-6 bei Achsennorm, paarweisem Skalarprodukt und det(R)=+1. Diese Rechentoleranz ist keine Messunsicherheit und keine Lagegenauigkeit.

Beide Frame-Definitionen müssen Ursprung und positive Achsrichtungen mit Evidenz beschreiben. Es gibt keinen voreingestellten Maschinenursprung, Gasstrom, Azimut oder ISO-konformen Standardframe. Numeric appliesTo benennt die betroffenen Entities. Ein Frame gilt für den durch Evidenz identifizierten Zustand; nach Umspannen, Wärmebehandlung mit relevanter Formänderung oder weiterer Präparation ist ein eigener Zustand/Frame anzulegen. Eine dynamische Transformationshistorie ist außerhalb dieses Kerns.

reported = Zahlen aus einer Quelle, nicht selbst gemessen. measured = aus Primärmessung. computed = nachvollziehbare Berechnung/Transformation. estimated = Schätzung mit Methode. exact = nominal exakte Definition oder Berechnung aus solchen Definitionen, kein Anspruch physischer Fehlerfreiheit. Status und Evidenz müssen zusammenpassen. Schematic-only genügt keiner numerischen Transformation.

Gemessene, geschätzte und berechnete Transformationen benötigen uncertainty.description, die Translation und Rotation einschließlich nicht quantifizierter Anteile erläutert. Optional translationBoundMm (euklidischer Translationsfehler) und rotationBoundDeg (relative Rotationswinkelabweichung); dies sind dokumentierte Grenzen, keine impliziten Standardabweichungen. Fehlende Zahlen sind unbekannt, nicht null. Kovarianz und Unsicherheitsfortpflanzung werden nicht implementiert. not-reported/not-applicable verbieten numerische Felder vollständig.

## Relative Orientierung und Messregionen

Constraints können z. B. den Winkel zwischen einer Probenlängsachse und einer berichteten Baurichtung beschreiben, während Position und Azimut unbekannt bleiben. Features sind quellengebundene Bezeichnungen. Winkeldefinition: axis-to-axis zwischen den bezeichneten Richtungen; axis-to-plane zum Plane, 0° parallel und 90° normal; plane-to-plane als kleinerer Winkel, 0° parallel und 90° senkrecht. Keine Ableitung einer absoluten Transformation.

Eine numerisch lokalisierte Messregion benötigt einen passenden numerisch lokalisierten Frame. Eine rein relative Region nennt ihren anchor; eine reported-constraint-Orientierung verweist auf einen Constraint. Unbekannte Regionpositionen bleiben gültig. Eine Region ist eine Abstraktion; ihre exakte Kontur oder Abmessung wird durch diesen Kern nicht erzwungen.

## Normenbezug

[ISO 17295:2023](https://www.iso.org/standard/76471.html) ist eine relevante Referenz für Position, Koordinaten und Orientierung. Dieser Vertrag beansprucht keine geprüfte Konformität und kopiert keine normative Achsdefinition. Ein Import muss die tatsächliche Quellkonvention dokumentieren und die Umrechnung belegen.
