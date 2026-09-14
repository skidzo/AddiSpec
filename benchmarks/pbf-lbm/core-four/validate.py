#!/usr/bin/env python3
"""Generate and check the four nominal reference domains. No physical solver."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import sys

import gmsh

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]


def require(condition, message):
    if not condition:
        raise ValueError(message)


def close(actual, expected, label, rel=1e-6, absolute=2e-6):
    require(math.isfinite(actual) and math.isclose(actual, expected, rel_tol=rel, abs_tol=absolute),
            f"{label}: expected {expected}, got {actual}")


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def matrix(transform):
    b, t = transform["basis"], transform["translationMm"]
    axes = [b[k] for k in ("x", "y", "z")]
    require(len(t) == 3 and all(len(v) == 3 for v in axes), "invalid transform dimensions")
    require(all(math.isfinite(x) for v in axes + [t] for x in v), "nonfinite transform")
    for i in range(3):
        for j in range(3):
            close(sum(axes[i][k] * axes[j][k] for k in range(3)),
                  float(i == j), "orthonormal transform", absolute=1e-8)
    x, y, z = axes
    det = (x[0] * (y[1]*z[2]-y[2]*z[1])
           - y[0] * (x[1]*z[2]-x[2]*z[1])
           + z[0] * (x[1]*y[2]-x[2]*y[1]))
    close(det, 1., "right-handed transform", absolute=1e-8)
    return [axes[j][i] if j < 3 else t[i] for i in range(3) for j in range(4)] + [0, 0, 0, 1]


def controlled_source(case):
    source = case["source"]
    path = (ROOT / source["stepPath"]).resolve()
    spec_path = (ROOT / source["specimenPath"]).resolve()
    require(path.is_relative_to(ROOT) and spec_path.is_relative_to(ROOT), "source escapes repository")
    require(path.stat().st_size == source["bytes"], "source byte count changed")
    require(sha(path) == source["sha256"], "source SHA-256 changed; review the benchmark reference")
    spec = json.loads(spec_path.read_text())
    require(spec["id"] == source["specimenId"], "wrong specimen identity")
    require(spec["design"]["units"] == "mm", "specimen unit mismatch")
    require("SI_UNIT(.MILLI.,.METRE.)" in "".join(path.read_text().split()),
            "STEP must declare millimetres")
    artifacts = [a for a in spec["artifacts"] if a["format"] == "STEP"]
    require(len(artifacts) == 1, "expected one controlled STEP source")
    a = artifacts[0]
    require((spec_path.parent / a["path"]).resolve() == path, "wrong STEP path")
    require(a["sha256"] == source["sha256"] and a["bytes"] == source["bytes"],
            "specimen and benchmark artifact metadata disagree")
    evidence = json.loads((spec_path.parent / spec["evidence"]).read_text())
    require(evidence["specimenId"] == spec["id"], "wrong geometry evidence identity")
    require(evidence["artifact"]["sha256"] == source["sha256"], "evidence hash mismatch")
    if case["id"] == "overhang-45":
        require(spec["design"]["buildOrientation"]["buildAxis"] == "-Y",
                "stored overhang must declare source-local -Y growth")
    return path


def tensile(case):
    p = case["parameters"]
    require(all(isinstance(v, (int, float)) and math.isfinite(v) and v > 0 for v in p.values()),
            "tensile parameters must be finite positive dimensions")
    rg, rh = p["gaugeDiameterMm"]/2, p["gripDiameterMm"]/2
    radius, half = p["transitionRadiusMm"], p["parallelLengthMm"]/2
    require(rh > rg and rh-rg < 2*radius, "invalid tangent-arc shoulder")
    require(p["parallelLengthMm"] > p["originalGaugeLengthMm"], "gauge marks must fit parallel section")
    close(p["originalGaugeLengthMm"]/p["gaugeDiameterMm"], 5., "short proportional specimen L0/d0")
    delta = rh-rg
    span = math.sqrt(4*radius*delta-delta*delta)
    end = half + span + p["gripLengthMm"]
    occ = gmsh.model.occ

    def point(r, z):
        return occ.addPoint(r, 0, z)

    values = [(0, -end), (rh, -end), (rh, -half-span),
              ((rg+rh)/2, -half-span/2), (rg, -half), (rg, half),
              ((rg+rh)/2, half+span/2), (rh, half+span), (rh, end), (0, end)]
    pts = [point(*v) for v in values]
    centers = {2: point(rh-radius, -half-span), 3: point(rg+radius, -half),
               5: point(rg+radius, half), 6: point(rh-radius, half+span)}
    curves = [occ.addCircleArc(pts[i], centers[i], pts[i+1]) if i in centers
              else occ.addLine(pts[i], pts[i+1]) for i in range(len(pts)-1)]
    curves.append(occ.addLine(pts[-1], pts[0]))
    profile = occ.addPlaneSurface([occ.addCurveLoop(curves)])
    revolved = occ.revolve([(2, profile)], 0, 0, 0, 0, 0, 1, 2*math.pi)
    volumes = [(d, t) for d, t in revolved if d == 3]
    require(len(volumes) == 1, "tensile revolution did not produce one volume")
    occ.remove([(2, profile)], recursive=True)
    occ.synchronize()

    # Numerical quadrature of the independently defined radial profile.
    def radial(z):
        u = abs(z)-half
        if u <= 0:
            return rg
        if u >= span:
            return rh
        if u <= span/2:
            return rg+radius-math.sqrt(radius*radius-u*u)
        return rh-radius+math.sqrt(radius*radius-(span-u)**2)

    n = 20000
    dz = 2*end/n
    integral = sum((1 if i in (0, n) else 4 if i % 2 else 2) *
                   radial(-end+i*dz)**2 for i in range(n+1)) * dz/3
    expected = {"boundsMm": [[-rh, -rh, -end], [rh, rh, end]],
                "volumeMm3": math.pi*integral}
    blank = json.loads((ROOT / case["source"]["specimenPath"]).read_text())
    dims = blank["design"]["nominalDimensions"]
    t = case["derivation"]["finishedToBlankSource"]["translationMm"]
    matrix(case["derivation"]["finishedToBlankSource"])
    require(t == [0, 0, dims["length"]/2], "expected centered nominal extraction")
    require(2*rh < dims["diameter"] and 2*end < dims["length"], "no nominal machining allowance")
    return expected, {"totalLengthMm": 2*end, "radialStockMm": (dims["diameter"]-2*rh)/2,
                      "endStockMm": (dims["length"]-2*end)/2}


def check_geometry(case, expected):
    volumes = gmsh.model.getEntities(3)
    require(len(volumes) == 1, "expected exactly one solid domain")
    volume = volumes[0][1]
    bounds = list(gmsh.model.occ.getBoundingBox(3, volume))
    wanted = expected["boundsMm"][0] + expected["boundsMm"][1]
    for a, b in zip(bounds, wanted):
        close(a, b, "solid bound")
    mass = gmsh.model.occ.getMass(3, volume)
    close(mass, expected["volumeMm3"], "solid volume")
    faces = gmsh.model.getBoundary(volumes, oriented=False)
    groups = {"body": [volume], "lower": [], "upper": [], "downskin": [], "gauge_surface": []}
    downskin_normals = []
    for dim, tag in faces:
        kind = gmsh.model.getType(dim, tag).lower()
        if kind == "plane":
            center = list(gmsh.model.occ.getCenterOfMass(2, tag))
            if abs(center[2]-wanted[2]) < 1e-5:
                groups["lower"].append(tag)
            if abs(center[2]-wanted[5]) < 1e-5:
                groups["upper"].append(tag)
            if case["id"] == "overhang-45":
                uv = gmsh.model.getParametrization(2, tag, center)
                normal = list(gmsh.model.getNormal(tag, uv))
                probe = [center[i]+1e-4*normal[i] for i in range(3)]
                if gmsh.model.isInside(3, volume, probe):
                    normal = [-x for x in normal]
                if -1+1e-6 < normal[2] < -1e-6:
                    close(math.degrees(math.acos(-normal[2])), 45., "downskin to build plane", absolute=1e-5)
                    groups["downskin"].append(tag)
                    downskin_normals.append(normal)
        if case["recipe"] == "round-tensile" and kind == "cylinder":
            b = gmsh.model.occ.getBoundingBox(2, tag)
            p = case["parameters"]
            if abs(b[2]+p["parallelLengthMm"]/2) < 1e-5 and abs(b[5]-p["parallelLengthMm"]/2) < 1e-5:
                close(b[3]-b[0], p["gaugeDiameterMm"], "gauge diameter", absolute=1e-5)
                groups["gauge_surface"].append(tag)
    require(groups["lower"] and groups["upper"], "missing loading/base end faces")
    if case["id"] == "overhang-45":
        require(len(groups["downskin"]) == 1, "expected one genuinely inclined downward face")
    if case["recipe"] == "round-tensile":
        require(groups["gauge_surface"], "missing final parallel gauge surface")
    return {"boundsMm": bounds, "volumeMm3": mass, "solidCount": 1,
            "faceCount": len(faces), "regions": groups, "downskinNormals": downskin_normals}


def add_groups(regions):
    for name, tags in regions.items():
        if tags:
            gmsh.model.addPhysicalGroup(3 if name == "body" else 2, tags, name=name)


def mesh(case, size, level, output, geometry):
    gmsh.model.mesh.clear()
    gmsh.option.setNumber("Mesh.MeshSizeMin", size)
    gmsh.option.setNumber("Mesh.MeshSizeMax", size)
    gmsh.option.setNumber("Mesh.MeshSizeFromCurvature", 16)
    thickness_elements = None
    if case["mesh"]["method"] == "structured-hexahedral":
        thickness_elements = case["mesh"]["elementsThroughThickness"][level]
        for _, tag in gmsh.model.getEntities(1):
            b = gmsh.model.occ.getBoundingBox(1, tag)
            extents = [b[i+3]-b[i] for i in range(3)]
            axis = max(range(3), key=extents.__getitem__)
            count = thickness_elements if axis == 1 else math.ceil(round(extents[axis], 5)/size)
            gmsh.model.mesh.setTransfiniteCurve(tag, count+1)
        for _, tag in gmsh.model.getEntities(2):
            gmsh.model.mesh.setTransfiniteSurface(tag)
            gmsh.model.mesh.setRecombine(2, tag)
        gmsh.model.mesh.setTransfiniteVolume(gmsh.model.getEntities(3)[0][1])
    gmsh.model.mesh.generate(3)
    gmsh.model.mesh.setOrder(case["mesh"]["order"])
    types, tag_groups, _ = gmsh.model.mesh.getElements(3)
    tags = [int(t) for group in tag_groups for t in group]
    require(tags, "empty volume mesh")
    for typ in types:
        require(gmsh.model.mesh.getElementProperties(int(typ))[2] == 2, "expected second-order elements")
    det = list(gmsh.model.mesh.getElementQualities(tags, "minDetJac"))
    quality = list(gmsh.model.mesh.getElementQualities(tags, "minSICN"))
    require(all(math.isfinite(v) and v > 0 for v in det), "nonpositive or nonfinite Jacobian")
    require(all(math.isfinite(v) and v > 0 for v in quality), "invalid signed element quality")
    mesh_volume = sum(gmsh.model.mesh.getElementQualities(tags, "volume"))
    volume_error = abs(mesh_volume-geometry["volumeMm3"])/geometry["volumeMm3"]
    require(volume_error < .01, "mesh volume differs from CAD by >=1 percent")
    path = output / f"mesh-{level+1}.msh"
    gmsh.option.setNumber("Mesh.Binary", 1)
    gmsh.write(str(path))
    return {"targetSizeMm": size, "order": 2, "elements": len(tags),
            "elementTypes": [int(t) for t in types], "minimumJacobian": min(det),
            "minimumSignedQuality": min(quality), "meshVolumeMm3": float(mesh_volume),
            "relativeVolumeError": volume_error, "elementsThroughThickness": thickness_elements,
            "artifact": path.name, "sha256": sha(path)}


def run(case, output):
    gmsh.clear()
    gmsh.model.add(case["id"])
    path = controlled_source(case)
    stock = None
    if case["recipe"] == "round-tensile":
        expected, stock = tensile(case)
    else:
        volumes = gmsh.model.occ.importShapes(str(path), highestDimOnly=True)
        require(len(volumes) == 1 and volumes[0][0] == 3, "STEP import must yield one volume")
        gmsh.model.occ.affineTransform(volumes, matrix(case["transform"]))
        gmsh.model.occ.synchronize()
        expected = case["expected"]
    geometry = check_geometry(case, expected)
    output.mkdir(parents=True, exist_ok=True)
    step = output / "model.step"
    gmsh.write(str(step))
    # Exercise the actual exported exchange file with a fresh model.
    gmsh.clear()
    gmsh.model.add(case["id"]+"-roundtrip")
    gmsh.model.occ.importShapes(str(step), highestDimOnly=True)
    gmsh.model.occ.synchronize()
    geometry = check_geometry(case, expected)
    add_groups(geometry["regions"])
    meshes = [mesh(case, size, level, output, geometry)
              for level, size in enumerate(case["mesh"]["sizesMm"])]
    require(meshes[1]["elements"] > meshes[0]["elements"], "fine mesh must actually refine the domain")
    return {"id": case["id"], "geometry": geometry, "nominalMachiningStock": stock,
            "step": {"path": step.name, "sha256": sha(step), "bytes": step.stat().st_size},
            "meshes": meshes, "solverConvergence": "not-run", "physicalValidation": "not-performed"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    output = args.output.resolve()
    require(not output.exists(), "output directory must be new to preserve prior evidence")
    manifest_path = HERE / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    require(manifest["schemaVersion"] == "0.1.0" and manifest["units"] == "mm", "unsupported contract")
    require([c["id"] for c in manifest["cases"]] ==
            ["density-cube", "thin-wall", "overhang-45", "tensile-round-5x25"], "expected the approved four cases")
    output.mkdir(parents=True)
    report = {"schemaVersion": "0.1.0", "gmshVersion": gmsh.__version__,
              "manifestSha256": sha(manifest_path), "generatorSha256": sha(Path(__file__)),
              "scope": "nominal geometry and volume-mesh checks; no FEA solution or physical validation",
              "status": "running", "cases": []}
    gmsh.initialize()
    gmsh.option.setNumber("General.Terminal", 1)
    gmsh.option.setNumber("General.NumThreads", 1)
    try:
        for case in manifest["cases"]:
            result = run(case, output / case["id"])
            report["cases"].append(result)
            print("CORE_FOUR_RESULT " + json.dumps(result), flush=True)
        report["status"] = "passed"
    except Exception as exc:
        report["status"] = "failed"
        report["error"] = str(exc)
        raise
    finally:
        gmsh.finalize()
        (output / "report.json").write_text(json.dumps(report, indent=2)+"\n")
        print("CORE_FOUR_STATUS " + report["status"], flush=True)


if __name__ == "__main__":
    main()
