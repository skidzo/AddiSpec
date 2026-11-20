use crate::Result;
use serde_json::{Value, json};
use solidcore::Kernel;
use solidcore::mass::integrator::properties::brep_volume_default;
use solidcore_convert::brep::to_kernel_body;
use solidcore_record::brep::Surface;
use solidcore_record::step::{p21, product};
use solidcore_step::topology::read_solids;

fn reference(params: &[p21::Param], index: usize) -> Result<u64> {
    params
        .get(index)
        .and_then(p21::Param::as_ref_id)
        .ok_or_else(|| format!("missing reference at parameter {index}").into())
}

/// Resolve the two direct semantic PMI reference forms in the nanocct fixture.
/// Preserve STEP face identity, including when two analytic faces have the same area.
fn face_attachments(
    ex: &p21::Exchange,
    solids: &[solidcore_step::assembly::Solid],
) -> Result<Vec<Value>> {
    let mut out = Vec::new();
    for (&pmi_id, entity) in &ex.entities {
        let aspect = match entity.name() {
            "DIMENSIONAL_SIZE" => reference(entity.params(), 0)?,
            "CYLINDRICITY_TOLERANCE" => reference(entity.params(), 3)?,
            _ => continue,
        };
        let mut usages = ex
            .entities
            .values()
            .filter_map(|e| e.record("GEOMETRIC_ITEM_SPECIFIC_USAGE"))
            .filter(|args| reference(args, 2).ok() == Some(aspect));
        let args = usages.next().ok_or("PMI has no direct face attachment")?;
        if usages.next().is_some() {
            return Err("ambiguous PMI face attachment".into());
        }
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
