use crate::Result;
use serde_json::{Value, json};
use solidcore::Kernel;
use solidcore::mass::integrator::properties::brep_volume_default;
use solidcore_convert::brep::to_kernel_body;
use solidcore_record::brep::Surface;
use solidcore_record::step::{p21, product};
use solidcore_step::topology::read_solids;
use solidcore_step::units::{UnitKind, unit_factor};

fn reference(params: &[p21::Param], index: usize) -> Result<u64> {
    params
        .get(index)
        .and_then(p21::Param::as_ref_id)
        .ok_or_else(|| format!("missing reference at parameter {index}").into())
}

fn record<'a>(ex: &'a p21::Exchange, id: u64, kind: &str) -> Result<&'a [p21::Param]> {
    ex.get(id)
        .and_then(|e| e.record(kind))
        .ok_or_else(|| format!("missing {kind} record at #{id}").into())
}

fn referenced_by<'a>(
    ex: &'a p21::Exchange,
    kind: &str,
    parameter: usize,
    id: u64,
) -> Result<&'a [p21::Param]> {
    let mut matches = ex
        .entities
        .values()
        .filter_map(|e| e.record(kind))
        .filter(|args| reference(args, parameter).ok() == Some(id));
    let found = matches
        .next()
        .ok_or_else(|| format!("missing {kind} reference to #{id}"))?;
    if matches.next().is_some() {
        return Err(format!("ambiguous {kind} reference to #{id}").into());
    }
    Ok(found)
}

fn measure_mm(ex: &p21::Exchange, id: u64) -> Result<f64> {
    let entity = ex.get(id).ok_or("missing PMI measure")?;
    let args = entity
        .record("MEASURE_WITH_UNIT")
        .or_else(|| entity.record("LENGTH_MEASURE_WITH_UNIT"))
        .ok_or("unsupported PMI measure representation")?;
    let value = args
        .first()
        .and_then(p21::Param::as_f64)
        .ok_or("invalid PMI measure")?;
    let (UnitKind::Length, scale) =
        unit_factor(ex, reference(args, 1)?).ok_or("missing PMI unit")?
    else {
        return Err("PMI measure requires length units".into());
    };
    let scaled = value * scale;
    if !scaled.is_finite() {
        return Err("nonfinite PMI measure in millimetres".into());
    }
    Ok(scaled)
}

fn diameter(ex: &p21::Exchange, id: u64, entity: &p21::Entity) -> Result<Value> {
    if entity.params().get(1).and_then(p21::Param::as_str) != Some("diameter") {
        return Err("only diameter size is supported by the fixture adapter".into());
    }
    let rel = referenced_by(ex, "DIMENSIONAL_CHARACTERISTIC_REPRESENTATION", 0, id)?;
    let rep = record(ex, reference(rel, 1)?, "SHAPE_DIMENSION_REPRESENTATION")?;
    let [nominal] = rep
        .get(1)
        .and_then(p21::Param::as_list)
        .ok_or("missing dimension items")?
    else {
        return Err("expected one nominal dimension value".into());
    };
    let nominal = nominal
        .as_ref_id()
        .ok_or("invalid nominal dimension reference")?;
    let rel = referenced_by(ex, "PLUS_MINUS_TOLERANCE", 1, id)?;
    let limits = record(ex, reference(rel, 0)?, "TOLERANCE_VALUE")?;
    Ok(json!({
        "nominalMm": measure_mm(ex, nominal)?,
        "lowerDeviationMm": measure_mm(ex, reference(limits, 0)?)?,
        "upperDeviationMm": measure_mm(ex, reference(limits, 1)?)?,
    }))
}

/// Resolve the two direct semantic PMI reference forms in the nanocct fixture.
/// Preserve STEP face identity, including when two analytic faces have the same area.
fn face_attachments(
    ex: &p21::Exchange,
    solids: &[solidcore_step::assembly::Solid],
) -> Result<Vec<Value>> {
    let mut out = Vec::new();
    for (&pmi_id, entity) in &ex.entities {
        let (aspect, values) = match entity.name() {
            "DIMENSIONAL_SIZE" => (
                reference(entity.params(), 0)?,
                diameter(ex, pmi_id, entity)?,
            ),
            "CYLINDRICITY_TOLERANCE" => (
                reference(entity.params(), 3)?,
                json!({"valueMm": measure_mm(ex, reference(entity.params(), 2)?)?}),
            ),
            _ => continue,
        };
        let args = referenced_by(ex, "GEOMETRIC_ITEM_SPECIFIC_USAGE", 2, aspect)?;
        let face = reference(args, 4)?;
        let mut owners = solids.iter().filter(|s| s.face_origin.contains(&face));
        let solid = owners
            .next()
            .ok_or("PMI face did not survive geometry import")?;
        if owners.next().is_some() {
            return Err("PMI face has multiple imported owners".into());
        }
        let index = solid
            .face_origin
            .iter()
            .position(|&origin| origin == face)
            .ok_or("missing imported face index")?;
        let imported = solid.brep.faces.get(index).ok_or("missing imported face")?;
        let Surface::Cylinder { radius, .. } = imported.surface else {
            return Err("PMI attachment is not an imported cylinder".into());
        };
        out.push(json!({
            "kind": entity.name(), "stepEntity": pmi_id,
            "stepFace": face, "bodyEntity": solid.item, "cylinderRadiusMm": radius,
            "values": values,
        }));
    }
    Ok(out)
}

pub fn inspect(path: &str) -> Result<Value> {
    let ex = p21::parse(&std::fs::read_to_string(path)?)?;
    let products = product::read(&ex)?;
    let placed = solidcore_ops::placed_bodies(&products)?;
    let imported = read_solids(&ex);
    let mut k = Kernel::default();
    let solids = imported
        .solids
        .iter()
        .map(|solid| {
            let mut body = to_kernel_body(&mut k, &solid.brep, false)?;
            Ok(json!({
                "entity": solid.item, "product": solid.product, "stepFaces": solid.face_origin,
                "volumeMm3": brep_volume_default(&k, &mut body, 1e-9)?,
            }))
        })
        .collect::<Result<Vec<_>>>()?;
    Ok(json!({
        "schemas": ex.schemas,
        "roots": products.roots.len(),
        "occurrences": products.occurrences.len(),
        "bodies": placed.iter().map(|b| json!({
            "entity": b.entity, "rowVectorTransform": b.transform,
        })).collect::<Vec<_>>(),
        "solids": solids,
        "importFailures": imported.failures.iter().map(|f| json!({"entity": f.item, "reason": f.message})).collect::<Vec<_>>(),
        "pmiFaceAttachments": face_attachments(&ex, &imported.solids)?,
    }))
}
