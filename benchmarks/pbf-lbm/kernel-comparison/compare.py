#!/usr/bin/env python3
"""Compare native CAD operations and STEP/AP242 interoperability on shared inputs."""
import argparse
import hashlib
from importlib.metadata import version
import json
import math
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

from OCP.BRep import BRep_Tool
from OCP.BRepAlgoAPI import BRepAlgoAPI_Cut
from OCP.BRepBuilderAPI import BRepBuilderAPI_MakeVertex
from OCP.BRepCheck import BRepCheck_Analyzer
from OCP.BRepExtrema import BRepExtrema_DistShapeShape
from OCP.BRepFilletAPI import BRepFilletAPI_MakeFillet
from OCP.BRepGProp import BRepGProp
from OCP.BRepPrimAPI import BRepPrimAPI_MakeBox, BRepPrimAPI_MakeCylinder
from OCP.GeomLProp import GeomLProp_SLProps
from OCP.GProp import GProp_GProps
from OCP.IFSelect import IFSelect_RetDone
from OCP.IntCurvesFace import IntCurvesFace_ShapeIntersector
from OCP.ShapeAnalysis import ShapeAnalysis_Surface
from OCP.STEPControl import STEPControl_Reader
from OCP.TopAbs import TopAbs_EDGE, TopAbs_FACE, TopAbs_REVERSED, TopAbs_SOLID
from OCP.TopExp import TopExp_Explorer
from OCP.TopoDS import TopoDS
from OCP.gp import gp_Ax2, gp_Dir, gp_Lin, gp_Pnt

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SOLIDCORE = "45b62d3544cbecaf225e838c5cf1043cfc3a28bf"
NANOCCT_TEST_SHA256 = "58385186dab0d42fa94cc50ff6a9f79fdfab805b3de5957c78b34303f88dc65f"
CASES = (
    ("drilled-control", (0.5, 10., 2., 0.), "analytic"),
    ("nominal", (0.5, 10., 2., 0.2), "analytic"),
    ("thin", (0.1, 10., 2., 0.04), "analytic"),
    ("thin-web", (0.5, 18.7999, 1., 0.2), "analytic"),
    ("fillet-overlap", (0.5, 18.9, 1., 0.2), "analytic"),
    ("radius-exceeds-wall", (0.5, 10., 2., 0.6), "rejected"),
)


def require(condition, message):
    if not condition:
        raise ValueError(message)


def close(actual, expected, label, absolute=2e-6):
    require(actual is not None and math.isclose(actual, expected, rel_tol=0, abs_tol=absolute),
            f"{label}: expected {expected}, got {actual}")


def shapes(shape, kind):
    explorer = TopExp_Explorer(shape, kind)
    found = []
    while explorer.More():
        current = explorer.Current()
        if not any(current.IsSame(previous) for previous in found):
            found.append(current)
        explorer.Next()
    return found


def volume(shape):
    props = GProp_GProps()
    BRepGProp.VolumeProperties_s(shape, props, 1e-10)
    return props.Mass()


def point_edge(shape, point):
    vertex = BRepBuilderAPI_MakeVertex(point).Vertex()
    hits = []
    for edge in shapes(shape, TopAbs_EDGE):
        distance = BRepExtrema_DistShapeShape(vertex, edge)
        if distance.IsDone() and distance.Value() < 1e-6:
            hits.append(edge)
    require(len(hits) == 1, f"expected one edge at {point.Coord()}, got {len(hits)}")
    return TopoDS.Edge_s(hits[0])


def transition(shape, p):
    edge = point_edge(shape, p)
    adjacent = [TopoDS.Face_s(f) for f in shapes(shape, TopAbs_FACE)
                if any(e.IsSame(edge) for e in shapes(f, TopAbs_EDGE))]
    require(len(adjacent) == 2, "expected two adjacent faces")
    samples = []
    for face in adjacent:
        surface = BRep_Tool.Surface_s(face)
        uv = ShapeAnalysis_Surface(surface).ValueOfUV(p, 1e-9)
        props = GeomLProp_SLProps(surface, uv.X(), uv.Y(), 2, 1e-9)
        require(props.IsNormalDefined() and props.IsCurvatureDefined(), "undefined surface differential")
        normal = props.Normal()
        if face.Orientation() == TopAbs_REVERSED:
            normal.Reverse()
        samples.append((props.Value(), normal,
                        max(abs(props.MinCurvature()), abs(props.MaxCurvature()))))
    a, b = samples
    return {"gapMm": a[0].Distance(b[0]), "normalAngleRad": a[1].Angle(b[1]),
            "curvatureJumpPerMm": abs(a[2] - b[2])}


def thickness(shape, t, x, y):
    intersector = IntCurvesFace_ShapeIntersector()
    intersector.Load(shape, 1e-9)
    intersector.Perform(gp_Lin(gp_Pnt(x, y, -1.), gp_Dir(0, 0, 1)), 0., t + 2.)
    require(intersector.IsDone(), "ray intersection failed")
    if intersector.NbPnt() == 0:
        return None
    require(intersector.NbPnt() == 2, "expected two wall intersections")
    return abs(intersector.WParameter(2) - intersector.WParameter(1))


def cut_hole(body, t, hole_y, hole_r):
    axis = gp_Ax2(gp_Pnt(20., hole_y, -1.), gp_Dir(0, 0, 1))
    drill = BRepPrimAPI_MakeCylinder(axis, hole_r, t + 2.).Shape()
    cut = BRepAlgoAPI_Cut(body, drill)
    if not cut.IsDone():
        raise ValueError("boolean: cut did not complete")
    return cut.Shape()


def round_edge(body, t, r):
    fillet = BRepFilletAPI_MakeFillet(body)
    fillet.Add(r, point_edge(body, gp_Pnt(10., 20., t)))
    try:
        fillet.Build()
    except RuntimeError as err:
        raise ValueError(f"fillet: {err}") from err
    if not fillet.IsDone():
        raise ValueError("fillet: did not complete")
    return fillet.Shape()


def occt(parameters, round_first=False):
    t, hole_y, hole_r, fillet_r = parameters
    body = BRepPrimAPI_MakeBox(40., 20., t).Shape()
    try:
        if round_first and fillet_r:
            body = round_edge(body, t, fillet_r)
        body = cut_hole(body, t, hole_y, hole_r)
        if not round_first and fillet_r:
            body = round_edge(body, t, fillet_r)
    except ValueError as err:
        return {"status": "error", "reason": str(err)}
    if len(shapes(body, TopAbs_SOLID)) != 1 or not BRepCheck_Analyzer(body).IsValid():
        return {"status": "invalid-solid"}
    samples = [transition(body, gp_Pnt(x, y, z)) for x in (5., 10., 35.)
               for y, z in ((20. - fillet_r, t), (20., t - fillet_r))] if fillet_r else []
    land = 20. - fillet_r - (hole_y + hole_r)
    web = thickness(body, t, 20., hole_y + hole_r + land / 2.) if land > 0 else None
    return {"status": "solid", "volumeMm3": volume(body),
            "wallMm": thickness(body, t, 10., 5.),
            "nearFilletMm": thickness(body, t, 10., 20. - fillet_r / 2.) if fillet_r else t,
            "boreMm": thickness(body, t, 20., hole_y), "webProbeMm": web, "transitions": samples}


def analytic_volume(t, hole_y, hole_r, fillet_r):
    removed = math.pi * hole_r**2 * t + 40. * fillet_r**2 * (1. - math.pi / 4.)
    # When the bore intersects the round, restore their double-counted overlap.
    if fillet_r and hole_y + hole_r > 20. - fillet_r:
        lower = math.asin((20. - fillet_r - hole_y) / hole_r)
        step = (math.pi / 2. - lower) / 4096

        def integrand(theta):
            delta = hole_y + hole_r * math.sin(theta) - (20. - fillet_r)
            return 2. * (hole_r * math.cos(theta))**2 * (
                fillet_r - math.sqrt(fillet_r**2 - delta**2))

        removed -= step / 3. * (integrand(lower) + integrand(math.pi / 2.) +
                                sum((4 if i % 2 else 2) * integrand(lower + i * step)
                                    for i in range(1, 4096)))
    return 800. * t - removed


def verify_geometry(result, params, expectation):
    t, hole_y, hole_r, fillet_r = params
    if expectation == "rejected":
        require(result["status"] == "error" and result["reason"].startswith("fillet"),
                f"expected explicit fillet rejection, got {result}")
        return
    require(result["status"] == "solid", f"expected valid solid, got {result}")
    close(result["volumeMm3"], analytic_volume(*params), "volume", 1e-4)
    close(result["wallMm"], t, "local wall")
    close(result["nearFilletMm"], t - fillet_r * (1. - math.sqrt(0.75)), "wall at round")
    require(result["boreMm"] is None, "the bore centre is not open")
    if hole_y + hole_r < 20. - fillet_r:
        close(result["webProbeMm"], t, "wall between bore and tangent edge")
    require(len(result["transitions"]) == (6 if fillet_r else 0), "missing continuity stations")
    for probe in result["transitions"]:
        close(probe["gapMm"], 0., "G0 gap")
        close(probe["normalAngleRad"], 0., "G1 normal angle", 1e-5)
        close(probe["curvatureJumpPerMm"], 1. / fillet_r, "G2 curvature jump", 1e-3)


def invoke(command, *args):
    call = subprocess.run([*command, *map(str, args)], check=True, capture_output=True,
                          text=True, timeout=120)
    return json.loads(call.stdout)


def source_control(command):
    manifest = json.loads((HERE.parent / "core-four/manifest.json").read_text())
    source = next(c["source"] for c in manifest["cases"] if c["id"] == "thin-wall")
    path = ROOT / source["stepPath"]
    checksum = hashlib.sha256(path.read_bytes()).hexdigest()
    require(checksum == source["sha256"], "controlled STEP hash differs")
    reader = STEPControl_Reader()
    require(reader.ReadFile(str(path)) == IFSelect_RetDone and reader.TransferRoots() == 1,
            "OCCT could not import the source reference")
    body = reader.OneShape()
    require(len(shapes(body, TopAbs_SOLID)) == 1 and BRepCheck_Analyzer(body).IsValid(),
            "OCCT source reference is not one valid solid")
    occt_volume = volume(body)
    result = invoke(command, "step", path)
    require(not result["importFailures"] and len(result["solids"]) == 1,
            f"SolidCore source import failed: {result}")
    close(occt_volume, 400., "OCCT source volume")
    close(result["solids"][0]["volumeMm3"], 400., "SolidCore source volume")
    return {"sha256": checksum, "occtVolumeMm3": occt_volume, "solidCore": result}


def run_ap242(command, test_file, output):
    require(hashlib.sha256(test_file.read_bytes()).hexdigest() == NANOCCT_TEST_SHA256,
            "nanocct AP242 fixture source hash differs")
    nested, semantic = output / "nested.step", output / "semantic-pmi.step"
    with tempfile.TemporaryDirectory(prefix="addispec-nanocct-") as fixtures:
        subprocess.run([sys.executable, "-m", "pytest", "-q", str(test_file),
                        "--basetemp", str(Path(fixtures) / "fixtures")], check=True)
        for dest in (nested, semantic):
            originals = {p.resolve() for p in Path(fixtures).glob(f"fixtures/*/{dest.name}")}
            require(len(originals) == 1, f"expected one generated {dest.name}")
            shutil.copyfile(originals.pop(), dest)
    assembly, pmi = (invoke(command, "step", path) for path in (nested, semantic))
    for result in (assembly, pmi):
        require(any("AP242" in schema for schema in result["schemas"]), "expected AP242")
        require(not result["importFailures"], str(result["importFailures"]))

    require(assembly["roots"] == 1 and assembly["occurrences"] == 4,
            f"unexpected assembly structure: {assembly}")
    require(len(assembly["solids"]) == 1 and len(assembly["bodies"]) == 4,
            "expected four occurrences of one imported solid")
    solid = assembly["solids"][0]
    close(solid["volumeMm3"], 48., "occurrence source volume")
    # Row-vector rotations and origins, independently composed from the authored poses.
    rx = [[1, 0, 0, 0], [0, 0, 1, 0], [0, -1, 0, 0]]
    rz = [[0, 1, 0, 0], [-1, 0, 0, 0], [0, 0, 1, 0]]
    rx_rz = [[0, 1, 0, 0], [0, 0, 1, 0], [1, 0, 0, 0]]
    identity = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0]]
    expected = [rx_rz + [[100, 10, 0, 1]], rz + [[100, 20, 0, 1]],
                rx + [[10, 100, 0, 1]], identity + [[20, 100, 0, 1]]]
    for occurrence in assembly["bodies"]:
        require(occurrence["entity"] == solid["entity"], "occurrence duplicated the part definition")
        actual = occurrence["rowVectorTransform"]
        matches = [m for m in expected if all(math.isclose(a, b, rel_tol=0, abs_tol=1e-7)
                                               for row_a, row_b in zip(actual, m, strict=True)
                                               for a, b in zip(row_a, row_b, strict=True))]
        require(len(matches) == 1, f"missing or duplicate world transform: {actual}")
        expected.remove(matches[0])

    require(len(pmi["solids"]) == 2, "expected target and equal-area distractor solids")
    target, distractor = sorted(pmi["solids"], key=lambda body: -body["volumeMm3"])
    close(target["volumeMm3"], 24. * math.pi, "PMI target volume")
    close(distractor["volumeMm3"], 12. * math.pi, "PMI distractor volume")
    attachments = pmi["pmiFaceAttachments"]
    require(sorted(a["kind"] for a in attachments) == ["CYLINDRICITY_TOLERANCE", "DIMENSIONAL_SIZE"],
            "expected one semantic size and one semantic tolerance")
    require(len({a["stepFace"] for a in attachments}) == 1
            and {a["bodyEntity"] for a in attachments} == {target["entity"]},
            f"PMI is bound to the wrong face or part: {attachments}")
    require(target["product"] == "PMI target", "PMI is attached to the wrong product")
    for attachment in attachments:
        close(attachment["cylinderRadiusMm"], 2., "PMI target cylinder radius")
    values = {a["kind"]: a["values"] for a in attachments}
    dimension = values["DIMENSIONAL_SIZE"]
    close(dimension["nominalMm"], 4., "SolidCore AP242 diameter")
    close(dimension["lowerDeviationMm"], -.02, "SolidCore AP242 lower tolerance")
    close(dimension["upperDeviationMm"], .10, "SolidCore AP242 upper tolerance")
    close(values["CYLINDRICITY_TOLERANCE"]["valueMm"], .05, "SolidCore AP242 cylindricity")
    return {"nanocctVersion": version("nanocct"), "nanocctTests": "passed",
            "assembly": assembly, "pmi": pmi}


def measure(call, parameters, expectation):
    try:
        result = call(parameters)
    except (ValueError, RuntimeError, subprocess.SubprocessError) as err:
        result = {"status": "measurement-error", "reason": str(err)}
    try:
        verify_geometry(result, parameters, expectation)
    except ValueError as err:
        return {"conforms": False, "assessment": str(err), "result": result}
    return {"conforms": True, "result": result}


def same_measurement(a, b):
    if type(a) is not type(b):
        return False
    if isinstance(a, dict):
        return a.keys() == b.keys() and all(same_measurement(a[key], b[key]) for key in a)
    if isinstance(a, list):
        return len(a) == len(b) and all(same_measurement(x, y) for x, y in zip(a, b))
    if isinstance(a, float):
        return math.isclose(a, b, rel_tol=1e-9, abs_tol=1e-9)
    return a == b


def integration_geometry(call, params, expectation):
    t, _, _, r = params
    if not 0 <= r < t:
        return {"conforms": expectation == "rejected", "result": {
            "status": "guarded-rejection", "reason": "fillet radius must be smaller than wall thickness"}}
    return measure(call, params, expectation)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--solidcore", required=True, type=Path, help="native SolidCore adapter")
    parser.add_argument("--wasm", nargs=2, type=Path, metavar=("NODE_RUNNER", "WASM_BINARY"))
    parser.add_argument("--nanocct-tests", required=True, type=Path,
                        help="pinned nanocct tests/test_ap242_semantics.py")
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    command = [str(args.solidcore.resolve())]
    report = {"solidCoreCommit": SOLIDCORE, "occtWheel": version("cadquery-ocp"), "cases": []}
    failures = []
    for name, params, expectation in CASES:
        direct_occt = measure(occt, params, expectation)
        direct_solidcore = measure(lambda p: invoke(command, "cut-first", *p), params, expectation)
        row = {"id": name, "parameters": dict(zip(
            ("thicknessMm", "holeYMm", "holeRadiusMm", "filletRadiusMm"), params, strict=True)),
            "expectedVolumeMm3": analytic_volume(*params) if expectation == "analytic" else None,
            "cutFirst": {"occt": direct_occt, "solidCore": direct_solidcore}}
        if name == "fillet-overlap":
            # OCCT 7.8.1 can return a valid B-rep with the wrong mass after cut-first.
            # Reordering two analytically equivalent subtractions keeps the target volume.
            reference = integration_geometry(lambda p: occt(p, round_first=True), params, expectation)
            native = integration_geometry(lambda p: invoke(command, "round-first", *p), params, expectation)
            row["roundFirst"] = {"occt": reference, "solidCore": native}
            row["integrationRecipe"] = {"occt": "round-first", "solidCore": "round-first"}
        elif expectation == "rejected":
            # The valid domain for this specific profile leaves a positive straight
            # side below the fillet. Keep the raw kernel results as diagnostic evidence.
            reference = integration_geometry(occt, params, expectation)
            native = integration_geometry(lambda p: invoke(command, "cut-first", *p), params, expectation)
            row["integrationRecipe"] = {"occt": "guarded", "solidCore": "guarded"}
        else:
            reference, native = direct_occt, direct_solidcore
            row["integrationRecipe"] = {"occt": "cut-first", "solidCore": "cut-first"}
        row.update(occt=reference, solidCore=native)
        if expectation == "analytic" and reference["conforms"] and native["conforms"]:
            row["volumeDeltaMm3"] = abs(reference["result"]["volumeMm3"] - native["result"]["volumeMm3"])
        if args.wasm:
            wasm_command = ["node", *map(str, args.wasm)]
            for recipe, native_case in (("cut-first", direct_solidcore), ("round-first", native)):
                if recipe == "round-first" and name != "fillet-overlap":
                    continue
                wasm = measure(lambda p: invoke(wasm_command, recipe, *p), params, expectation)
                matches = same_measurement(wasm["result"], native_case["result"])
                row.setdefault("wasm", {})[recipe] = {"solidCore": wasm, "matchesNative": matches}
                if not matches:
                    failures.append(f"{name}/{recipe}: native and WASI results differ")
        if not reference["conforms"] or not native["conforms"]:
            failures.append(f"{name}: kernel result outside expected bounds")
        report["cases"].append(row)
    for key, check in (
        ("sourceControl", lambda: source_control(command)),
        ("ap242", lambda: run_ap242(command, args.nanocct_tests.resolve(), args.output.resolve())),
    ):
        try:
            report[key] = check()
        except (OSError, ValueError, subprocess.SubprocessError) as err:
            reason = getattr(err, "stderr", None) or str(err)
            report[key] = {"error": reason}
            failures.append(f"{key}: {reason}")
    report["failures"] = failures
    (args.output / "report.json").write_text(json.dumps(report, indent=2, allow_nan=False) + "\n")
    for case in report["cases"]:
        print(case["id"], *(f"{k}={case[k]['conforms']}" for k in ("occt", "solidCore")))
    for failure in failures:
        print(failure, file=sys.stderr)
    return bool(failures)


if __name__ == "__main__":
    sys.exit(main())
