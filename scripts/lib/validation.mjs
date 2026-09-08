function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function matchesType(value, type) {
  switch (type) {
    case 'array': return Array.isArray(value);
    case 'object': return value !== null && typeof value === 'object' && !Array.isArray(value);
    case 'integer': return Number.isInteger(value);
    case 'number': return typeof value === 'number' && Number.isFinite(value);
    case 'null': return value === null;
    default: return typeof value === type;
  }
}

const supportedSchemaKeywords = new Set([
  '$id',
  '$schema',
  'additionalProperties',
  'const',
  'description',
  'enum',
  'exclusiveMaximum',
  'exclusiveMinimum',
  'items',
  'maximum',
  'maxItems',
  'minimum',
  'minItems',
  'minLength',
  'minProperties',
  'pattern',
  'properties',
  'required',
  'title',
  'type',
  'uniqueItems'
]);

export function validateSupportedSchema(schema, location = '$') {
  const errors = [];

  function visit(rule, path) {
    if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
      errors.push(`${path}: schema rule must be an object`);
      return;
    }
    for (const keyword of Object.keys(rule)) {
      if (!supportedSchemaKeywords.has(keyword)) errors.push(`${path}: unsupported schema keyword ${keyword}`);
    }
    for (const [name, propertyRule] of Object.entries(rule.properties ?? {})) {
      visit(propertyRule, `${path}.properties.${name}`);
    }
    if (rule.items) visit(rule.items, `${path}.items`);
    if (rule.additionalProperties && typeof rule.additionalProperties === 'object') {
      visit(rule.additionalProperties, `${path}.additionalProperties`);
    }
  }

  visit(schema, location);
  return errors;
}

export function validateAgainstSchema(value, schema, location = '$') {
  const errors = [];

  function validate(current, rule, path) {
    if (Object.hasOwn(rule, 'const') && !sameValue(current, rule.const)) {
      errors.push(`${path}: expected constant ${JSON.stringify(rule.const)}`);
    }

    if (rule.enum && !rule.enum.some(candidate => sameValue(current, candidate))) {
      errors.push(`${path}: expected one of ${rule.enum.map(JSON.stringify).join(', ')}`);
    }

    if (rule.type) {
      const allowedTypes = Array.isArray(rule.type) ? rule.type : [rule.type];
      if (!allowedTypes.some(type => matchesType(current, type))) {
        errors.push(`${path}: expected ${allowedTypes.join(' or ')}`);
        return;
      }
    }

    if (typeof current === 'string') {
      if (rule.minLength !== undefined && current.length < rule.minLength) {
        errors.push(`${path}: must contain at least ${rule.minLength} character(s)`);
      }
      if (rule.pattern && !(new RegExp(rule.pattern)).test(current)) {
        errors.push(`${path}: does not match ${rule.pattern}`);
      }
    }

    if (typeof current === 'number') {
      if (rule.minimum !== undefined && current < rule.minimum) {
        errors.push(`${path}: must be >= ${rule.minimum}`);
      }
      if (rule.maximum !== undefined && current > rule.maximum) {
        errors.push(`${path}: must be <= ${rule.maximum}`);
      }
      if (rule.exclusiveMinimum !== undefined && current <= rule.exclusiveMinimum) {
        errors.push(`${path}: must be > ${rule.exclusiveMinimum}`);
      }
      if (rule.exclusiveMaximum !== undefined && current >= rule.exclusiveMaximum) {
        errors.push(`${path}: must be < ${rule.exclusiveMaximum}`);
      }
    }

    if (Array.isArray(current)) {
      if (rule.minItems !== undefined && current.length < rule.minItems) {
        errors.push(`${path}: must contain at least ${rule.minItems} item(s)`);
      }
      if (rule.maxItems !== undefined && current.length > rule.maxItems) {
        errors.push(`${path}: must contain at most ${rule.maxItems} item(s)`);
      }
      if (rule.uniqueItems) {
        const serialized = current.map(item => JSON.stringify(item));
        if (new Set(serialized).size !== serialized.length) {
          errors.push(`${path}: items must be unique`);
        }
      }
      if (rule.items) {
        current.forEach((item, index) => validate(item, rule.items, `${path}[${index}]`));
      }
    }

    if (current !== null && typeof current === 'object' && !Array.isArray(current)) {
      const keys = Object.keys(current);
      if (rule.minProperties !== undefined && keys.length < rule.minProperties) {
        errors.push(`${path}: must contain at least ${rule.minProperties} propert${rule.minProperties === 1 ? 'y' : 'ies'}`);
      }

      for (const required of rule.required ?? []) {
        if (!Object.hasOwn(current, required)) {
          errors.push(`${path}: missing required property ${required}`);
        }
      }

      const properties = rule.properties ?? {};
      for (const [name, propertyRule] of Object.entries(properties)) {
        if (Object.hasOwn(current, name)) validate(current[name], propertyRule, `${path}.${name}`);
      }

      const additionalKeys = keys.filter(name => !Object.hasOwn(properties, name));
      if (rule.additionalProperties === false) {
        additionalKeys.forEach(name => errors.push(`${path}: unexpected property ${name}`));
      } else if (rule.additionalProperties && typeof rule.additionalProperties === 'object') {
        additionalKeys.forEach(name => validate(current[name], rule.additionalProperties, `${path}.${name}`));
      }
    }
  }

  validate(value, schema, location);
  return errors;
}

function dot(left, right) {
  return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

function norm(vector) {
  return Math.sqrt(dot(vector, vector));
}

function determinant({ x, y, z }) {
  return x[0] * (y[1] * z[2] - y[2] * z[1])
    - y[0] * (x[1] * z[2] - x[2] * z[1])
    + z[0] * (x[1] * y[2] - x[2] * y[1]);
}

export function validateRightHandedBasis(basis, tolerance = 1e-6) {
  if (!basis || !['x', 'y', 'z'].every(axis => Array.isArray(basis[axis]) && basis[axis].length === 3)) {
    return ['basis must contain x, y and z vectors with three components each'];
  }

  if (!['x', 'y', 'z'].every(axis => basis[axis].every(Number.isFinite))) return ['basis components must be finite numbers'];
  const errors = [];
  for (const axis of ['x', 'y', 'z']) {
    if (Math.abs(norm(basis[axis]) - 1) > tolerance) errors.push(`${axis} axis is not normalized`);
  }
  for (const [left, right] of [['x', 'y'], ['x', 'z'], ['y', 'z']]) {
    if (Math.abs(dot(basis[left], basis[right])) > tolerance) errors.push(`${left} and ${right} axes are not orthogonal`);
  }
  if (Math.abs(determinant(basis) - 1) > tolerance) errors.push('basis is not right-handed with determinant +1');
  return errors;
}

export function findDirectedCycle(nodes, edges) {
  nodes = [...nodes];
  const adjacency = new Map([...nodes].map(node => [node, []]));
  for (const [from, to] of edges) adjacency.get(from)?.push(to);

  const visiting = new Set();
  const visited = new Set();
  const path = [];

  function visit(node) {
    if (visiting.has(node)) {
      const start = path.indexOf(node);
      return [...path.slice(start), node];
    }
    if (visited.has(node)) return null;

    visiting.add(node);
    path.push(node);
    for (const neighbour of adjacency.get(node) ?? []) {
      const cycle = visit(neighbour);
      if (cycle) return cycle;
    }
    path.pop();
    visiting.delete(node);
    visited.add(node);
    return null;
  }

  for (const node of nodes) {
    const cycle = visit(node);
    if (cycle) return cycle;
  }
  return null;
}
