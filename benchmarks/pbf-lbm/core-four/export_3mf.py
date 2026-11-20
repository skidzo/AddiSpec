"""Export and verify 3MF Core + Production geometry for two Core-Four cases."""
import argparse
import hashlib
from importlib.metadata import version
import json
import math
from pathlib import Path
from uuid import uuid4
from xml.etree import ElementTree
from zipfile import ZipFile

import cadquery
import lib3mf
import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
CASES = {"density-cube": [(30, 30, 0), (55, 30, 0)], "overhang-45": [(30, 30, 0)]}
CHORD_TOLERANCE_MM = 0.005
ANGULAR_TOLERANCE_RAD = 0.1
CORE_NS = "http://schemas.microsoft.com/3dmanufacturing/core/2015/02"
PRODUCTION_NS = "http://schemas.microsoft.com/3dmanufacturing/production/2015/06"


def require(condition, message):
    if not condition:
        raise ValueError(message)


def fingerprint(path):
    data = path.read_bytes()
    return {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}


def controlled_step(case):
    source = case["source"]
    step = (ROOT / source["stepPath"]).resolve()
    record = (ROOT / source["specimenPath"]).resolve()
    require(step.is_relative_to(ROOT) and record.is_relative_to(ROOT), "Unexpected source location")
    specimen = json.loads(record.read_text())
    require(specimen["id"] == source["specimenId"] and specimen["design"]["units"] == "mm",
            "Specimen identity or units changed")
    descriptor, = (artifact for artifact in specimen["artifacts"] if artifact["format"] == "STEP")
    require((record.parent / descriptor["path"]).resolve() == step, "Controlled STEP path mismatch")
    evidence_path = (record.parent / specimen["evidence"]).resolve()
    require(evidence_path.is_relative_to(record.parent), "Unexpected evidence location")
    evidence = json.loads(evidence_path.read_text())
    require(evidence["specimenId"] == source["specimenId"], "Evidence specimen mismatch")
    measured = fingerprint(step)
    require(all(measured == {key: item[key] for key in ("bytes", "sha256")}
                for item in (source, descriptor, evidence["artifact"])), "Source STEP fingerprint mismatch")
    return step


def make_mesh(model, solid):
    points, triangles = solid.tessellate(CHORD_TOLERANCE_MM, ANGULAR_TOLERANCE_RAD)
    # Both cases are planar solids. Exact welding joins shared face-boundary vertices.
    coords = list(dict.fromkeys(point.toTuple() for point in points))
    index = {point: i for i, point in enumerate(coords)}
    positions = []
    for xyz in coords:
        position = lib3mf.Position()
        position.Coordinates[:] = xyz
        positions.append(position)
    indices = []
    for face in triangles:
        triangle = lib3mf.Triangle()
        triangle.Indices[:] = tuple(index[points[i].toTuple()] for i in face)
        indices.append(triangle)
    mesh = model.AddMeshObject()
    mesh.SetGeometry(positions, indices)
    require(mesh.IsManifoldAndOriented(), "Export mesh must be manifold and consistently oriented")
    return mesh, coords


def verify_package(wrapper, path, case, coords, build_uuid, object_uuid, instance_uuids):
    with ZipFile(path) as archive:
        model_xml = ElementTree.fromstring(archive.read("3D/3dmodel.model"))
    ns = {"c": CORE_NS, "p": PRODUCTION_NS}
    build = model_xml.find("c:build", ns)
    require(build.get(f"{{{PRODUCTION_NS}}}UUID") == build_uuid, "Build UUID did not round-trip")
    require([item.get(f"{{{PRODUCTION_NS}}}UUID") for item in build.findall("c:item", ns)] == instance_uuids,
            "Build item UUIDs did not round-trip")
    loaded = wrapper.CreateModel()
    loaded.QueryReader("3mf").ReadFromFile(str(path))
    require(loaded.GetUnit() == lib3mf.ModelUnit.MilliMeter, "Round-trip units must be millimetres")
    mesh_items = loaded.GetMeshObjects()
    require(mesh_items.MoveNext(), "Expected one geometry resource")
    mesh = mesh_items.GetCurrentMeshObject()
    require(not mesh_items.MoveNext() and mesh.IsManifoldAndOriented(), "Invalid round-trip mesh")
    points = np.array([tuple(vertex.Coordinates) for vertex in mesh.GetVertices()])
    faces = np.array([tuple(triangle.Indices) for triangle in mesh.GetTriangleIndices()])
    require(points.shape == (len(coords), 3) and np.allclose(points, coords, atol=1e-5, rtol=0),
            "Mesh coordinates must remain in the STEP source frame")
    a, b, c = (points[faces[:, i]] for i in range(3))
    volume = np.sum(np.einsum("ij,ij->i", a, np.cross(b, c))) / 6
    require(math.isclose(volume, case["expected"]["volumeMm3"], rel_tol=1e-6), "Mesh volume mismatch")

    items = loaded.GetBuildItems()
    placements = []
    xml_object, = model_xml.findall("c:resources/c:object", ns)
    for extra_offset in CASES[case["id"]]:
        require(items.MoveNext(), "Missing build instance")
        item = items.GetCurrent()
        require(xml_object.get(f"{{{PRODUCTION_NS}}}UUID") == object_uuid
                and item.GetObjectResourceID() == mesh.GetResourceID(), "Instance geometry binding mismatch")
        matrix = np.array([list(row) for row in item.GetObjectTransform().Fields])
        placed = points @ matrix[:3] + matrix[3]
        bounds = np.array([placed.min(axis=0), placed.max(axis=0)])
        expected_bounds = np.array(case["expected"]["boundsMm"]) + extra_offset
        require(np.allclose(bounds, expected_bounds, atol=1e-5, rtol=0), "Build bounds mismatch")
        if case["id"] == "overhang-45":
            require(np.allclose(np.array([0, -1, 0]) @ matrix[:3], [0, 0, 1]), "Expected -Y to +Z")
            normals = np.cross(placed[faces[:, 1]] - placed[faces[:, 0]],
                               placed[faces[:, 2]] - placed[faces[:, 0]])
            vertical_fraction = normals[:, 2] / np.linalg.norm(normals, axis=1)
            downskin = vertical_fraction[(vertical_fraction < -1e-5) & (vertical_fraction > -1 + 1e-5)]
            angles = np.degrees(np.arccos(-downskin))
            require(len(angles) and np.allclose(angles, case["expected"]["downskinAngleToBuildPlaneDeg"],
                                                atol=1e-5, rtol=0), "Expected 45-degree downskin")
        placements.append({"matrixRows3mf": matrix.tolist(), "boundsMm": bounds.tolist()})
    require(not items.MoveNext(), "Unexpected build instance")
    return float(volume), placements


def export_case(wrapper, case, output):
    step = controlled_step(case)
    solid = cadquery.importers.importStep(str(step)).val()
    require(solid.isValid() and len(solid.Solids()) == 1, "Expected a valid STEP solid")
    model = wrapper.CreateModel()
    model.SetUnit(lib3mf.ModelUnit.MilliMeter)
    build_uuid, object_uuid = str(uuid4()), str(uuid4())
    model.SetBuildUUID(build_uuid)
    mesh, coords = make_mesh(model, solid)
    mesh.SetName(case["source"]["specimenId"])
    mesh.SetUUID(object_uuid)

    # lib3mf's 4x3 matrix stores the three basis vectors, followed by translation.
    placement = case["transform"]
    instance_uuids = []
    for extra_offset in CASES[case["id"]]:
        transform = wrapper.GetIdentityTransform()
        for row, axis in enumerate("xyz"):
            transform.Fields[row][:] = placement["basis"][axis]
        transform.Fields[3][:] = tuple(a + b for a, b in zip(placement["translationMm"], extra_offset, strict=True))
        item = model.AddBuildItem(mesh, transform)
        item_uuid = str(uuid4())
        item.SetUUID(item_uuid)
        instance_uuids.append(item_uuid)

    path = output / f"{case['id']}.3mf"
    model.QueryWriter("3mf").WriteToFile(str(path))
    volume, placements = verify_package(wrapper, path, case, coords, build_uuid, object_uuid, instance_uuids)
    return {
        "caseId": case["id"],
        "specimenId": case["source"]["specimenId"],
        "sourceStep": {"path": case["source"]["stepPath"], **fingerprint(step)},
        "buildUuid": build_uuid,
        "objectUuid": object_uuid,
        "buildItems": [{"uuid": item_uuid, **placement}
                       for item_uuid, placement in zip(instance_uuids, placements, strict=True)],
        "artifact": {"role": "derived-geometry", "format": "3MF", "path": path.name, **fingerprint(path)},
        "volumeMm3": volume,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    output = parser.parse_args().output.resolve()
    output.mkdir(parents=True, exist_ok=False)
    manifest = json.loads((HERE / "manifest.json").read_text())
    cases = {case["id"]: case for case in manifest["cases"]}
    wrapper = lib3mf.get_wrapper()
    report = {
        "scope": "digital geometry and Production placement only",
        "units": "mm",
        "cadqueryVersion": version("cadquery"),
        "lib3mfVersion": ".".join(map(str, wrapper.GetLibraryVersion())),
        "coreFourManifest": fingerprint(HERE / "manifest.json"),
        "chordToleranceMm": CHORD_TOLERANCE_MM,
        "angularToleranceRad": ANGULAR_TOLERANCE_RAD,
        "cases": [export_case(wrapper, cases[case_id], output) for case_id in CASES],
    }
    uuids = [identifier for case in report["cases"]
             for identifier in [case["buildUuid"], case["objectUuid"], *(i["uuid"] for i in case["buildItems"])]]
    require(len(uuids) == len(set(uuids)), "Duplicate Production UUID")
    (output / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    print("3MF Core + Production round-trip passed for density-cube and overhang-45")


if __name__ == "__main__":
    main()
