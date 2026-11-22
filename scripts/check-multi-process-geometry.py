"""Parametric source and STEP round-trip check for the polymer and ceramic coupons."""

import argparse
import json
from math import isclose, pi
from pathlib import Path

import cadquery as cq

ROOT = Path(__file__).resolve().parents[1]
FAMILIES = ("dimensional-witness", "shrinkage-bar")


def box(x, y, z):
    return cq.Workplane("XY").box(x, y, z, centered=(False, False, False))


def nominal_shape(family, dimensions):
    x, y, z = (dimensions[key] for key in ("lengthX", "widthY", "heightZ"))
    if family == "shrinkage-bar":
        return box(x, y, z), x * y * z

    base = dimensions["baseThickness"]
    step = dimensions["stepLengthX"]
    radius = dimensions["holeDiameter"] / 2
    hole = (
        cq.Workplane("XY")
        .center(dimensions["holeCenterX"], dimensions["holeCenterY"])
        .circle(radius)
        .extrude(base)
    )
    shape = box(x, y, base).union(box(step, y, z)).cut(hole)
    volume = x * y * base + step * y * (z - base) - pi * radius**2 * base
    return shape, volume


def check_step(path, shape, volume):
    imported = cq.importers.importStep(str(path))
    solid = imported.val()
    bounds = solid.BoundingBox()
    nominal = shape.val().BoundingBox()
    coordinates = ("xmin", "ymin", "zmin", "xmax", "ymax", "zmax")
    if (
        not solid.isValid()
        or imported.solids().size() != 1
        or not isclose(solid.Volume(), volume, abs_tol=1e-6)
        or any(
            not isclose(getattr(bounds, key), getattr(nominal, key), abs_tol=1e-6)
            for key in coordinates
        )
        or not isclose(solid.intersect(shape.val()).Volume(), volume, abs_tol=1e-6)
    ):
        raise ValueError(f"STEP does not match its nominal solid: {path}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--export-to", type=Path, help="Write fresh STEP exports to a separate directory")
    args = parser.parse_args()
    count = 0
    for path in sorted((ROOT / "specimens").glob("*/*/*/specimen.json")):
        specimen = json.loads(path.read_text())
        design = specimen["design"]
        family = design["geometryFamily"]
        if family not in FAMILIES:
            continue
        shape, volume = nominal_shape(family, design["nominalDimensions"])
        artifact = next(item for item in specimen["artifacts"] if item["format"] == "STEP")
        step_path = path.parent / artifact["path"]
        if args.export_to:
            step_path = args.export_to / step_path.name
            step_path.parent.mkdir(parents=True, exist_ok=True)
            cq.exporters.export(shape, str(step_path))
        check_step(step_path, shape, volume)
        print(f"{specimen['id']}: valid solid, {volume:.6f} mm³")
        count += 1
    if not count:
        parser.error("No polymer or ceramic coupons found")


if __name__ == "__main__":
    main()
