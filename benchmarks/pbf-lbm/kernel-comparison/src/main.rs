#[cfg(not(target_arch = "wasm32"))]
mod step;
use serde_json::{Value, json};
use solidcore::blend::fillet_executive::api::fillet_edges;
use solidcore::boolean::api_brep::boolean_difference;
use solidcore::mass::integrator::properties::brep_volume_default;
use solidcore::math::{Point3, Vec3};
use solidcore::primitive::api_primitives::{create_box, create_cylinder};
use solidcore::query::api_queries::{CurveClosestPoint, edge_closest_point};
use solidcore::query::brep::{BrepQuery, Ray};
use solidcore::query::continuity::continuity_at;
use solidcore::topology::EdgeId;
use solidcore::topology::brep::p2::is_manifold_solid;
use solidcore::topology::brep::validation::{CheckLevel, check_brep};
use solidcore::{Brep, Kernel};

type Result<T> = std::result::Result<T, Box<dyn std::error::Error>>;

fn edge(k: &Kernel, body: &Brep, p: Point3) -> Result<(EdgeId, CurveClosestPoint)> {
    let mut matches = body.edge_list().iter().filter_map(|&id| {
        let hit = edge_closest_point(k, body, id, p).ok()?;
        (hit.closest.distance < 1e-6).then_some((id, hit))
    });
    let found = matches.next().ok_or("no edge at probe point")?;
    if matches.next().is_some() {
        return Err("ambiguous edge at probe point".into());
    }
    Ok(found)
}

fn transition(k: &Kernel, body: &Brep, p: Point3) -> Result<Value> {
    let (id, hit) = edge(k, body, p)?;
    let mut uses = Vec::new();
    for &face_id in body.face_list() {
        let face = body.face(face_id)?;
        for &loop_id in &face.loops {
            if body.loop_(loop_id)?.edges.iter().any(|e| e.edge == id) {
                uses.push(face.faceuse.ok_or("missing face use")?);
                break;
            }
        }
    }
    let sides = uses.try_into().map_err(|_| "expected two adjacent faces")?;
    let sample = continuity_at(k, body, id, sides, hit.parameter, [None; 2])?
        .ok_or("no continuity result")?;
    Ok(json!({
        "gapMm": sample.gap,
        "normalAngleRad": sample.normal_angle,
        "curvatureJumpPerMm": sample.jumps[0].abs(),
    }))
}

fn thickness(k: &Kernel, b: &mut Brep, t: f64, x: f64, y: f64) -> Result<Option<f64>> {
    let query = BrepQuery::of_brep(b);
    let lower = query.first_face_hit(k, b, Ray::new(Point3::new(x, y, -1.0), Vec3::Z)?)?;
    let upper = query.first_face_hit(k, b, Ray::new(Point3::new(x, y, t + 1.0), -Vec3::Z)?)?;
    match (lower, upper) {
        (Some(a), Some(b)) => Ok(Some(b.point.z - a.point.z)),
        (None, None) => Ok(None),
        _ => Err("only one ray hit the solid".into()),
    }
}

fn round(k: &mut Kernel, body: &mut Brep, t: f64, r: f64) -> Result<()> {
    let (id, _) = edge(k, body, Point3::new(10.0, 20.0, t))?;
    fillet_edges(k, body, &[id], r, 1, 1, 1.0).map_err(|e| format!("fillet: {e}"))?;
    Ok(())
}

fn geometry([t, hole_y, hole_r, fillet_r]: [f64; 4], round_first: bool) -> Result<Value> {
    let mut k = Kernel::default();
    let mut block = create_box(&mut k, Point3::ZERO, 40.0, 20.0, t)?;
    let drill = create_cylinder(&mut k, Point3::new(20.0, hole_y, -1.0), hole_r, t + 2.0)?;
    if round_first && fillet_r > 0.0 {
        round(&mut k, &mut block, t, fillet_r)?;
    }
    let mut body = boolean_difference(&mut k, block, drill).map_err(|e| format!("boolean: {e}"))?;
    if !round_first && fillet_r > 0.0 {
        round(&mut k, &mut body, t, fillet_r)?;
    }
    let valid = is_manifold_solid(&body)?
        && check_brep(&mut k, &mut body, CheckLevel::Level2)?
            .lines()
            .is_empty();
    if !valid {
        return Ok(json!({"status": "invalid-solid"}));
    }
    let mut transitions = Vec::new();
    if fillet_r > 0.0 {
        for x in [5.0, 10.0, 35.0] {
            for p in [
                Point3::new(x, 20.0 - fillet_r, t),
                Point3::new(x, 20.0, t - fillet_r),
            ] {
                match transition(&k, &body, p) {
                    Ok(sample) => transitions.push(sample),
                    Err(err) => {
                        return Ok(json!({
                            "status": "transition-mismatch",
                            "reason": err.to_string(),
                            "validSolid": true,
                            "volumeMm3": brep_volume_default(&k, &mut body, 1e-9)?,
                        }));
                    }
                }
            }
        }
    }
    let land = (20.0 - fillet_r) - (hole_y + hole_r);
    let web = if land > 0.0 {
        thickness(&k, &mut body, t, 20.0, hole_y + hole_r + land / 2.0)?
    } else {
        None
    };
    Ok(json!({
        "status": "solid",
        "volumeMm3": brep_volume_default(&k, &mut body, 1e-9)?,
        "wallMm": thickness(&k, &mut body, t, 10.0, 5.0)?,
        "nearFilletMm": thickness(&k, &mut body, t, 10.0, if fillet_r > 0.0 {20.0 - fillet_r / 2.0} else {15.0})?,
        "boreMm": thickness(&k, &mut body, t, 20.0, hole_y)?,
        "webProbeMm": web,
        "transitions": transitions,
    }))
}

fn run() -> Result<Value> {
    let args: Vec<_> = std::env::args().skip(1).collect();
    match args.as_slice() {
        [mode, a, b, c, d] if mode == "cut-first" || mode == "round-first" => {
            let values = [a.parse()?, b.parse()?, c.parse()?, d.parse()?];
            Ok(geometry(values, mode == "round-first").unwrap_or_else(|err| json!({"status": "error", "reason": err.to_string()})))
        }
        #[cfg(not(target_arch = "wasm32"))]
        [mode, path] if mode == "step" => step::inspect(path),
        _ => Err("usage: addispec-kernel-comparison (cut-first|round-first) THICKNESS HOLE_Y HOLE_RADIUS FILLET_RADIUS | step STEP_FILE".into()),
    }
}

fn main() -> Result<()> {
    println!("{}", run()?);
    Ok(())
}
