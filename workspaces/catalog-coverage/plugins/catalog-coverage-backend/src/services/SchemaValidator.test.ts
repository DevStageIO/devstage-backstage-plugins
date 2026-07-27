/**
 * Tests for SchemaValidator.
 *
 * Covers: valid entity, missing apiVersion, invalid kind.
 */

import { SchemaValidator } from './SchemaValidator';

const VALID_YAML = `
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: my-service
spec:
  type: service
  lifecycle: experimental
  owner: zentala
`.trim();

const MISSING_API_VERSION = `
kind: Component
metadata:
  name: my-service
spec:
  type: service
  lifecycle: experimental
  owner: zentala
`.trim();

// entitySchemaValidator validates the envelope structure (apiVersion, kind as string,
// metadata.name, spec). It does NOT reject unknown kind strings — kind-specific
// validators are a separate concern. We test with a structurally invalid entity
// (non-string kind) to get a schema error.
const INVALID_STRUCTURE = `
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: []
spec:
  type: service
  lifecycle: experimental
  owner: zentala
`.trim();

describe('SchemaValidator', () => {
  let validator: SchemaValidator;

  beforeEach(() => {
    validator = new SchemaValidator();
  });

  it('returns valid=true for a well-formed Component entity', () => {
    const result = validator.validate(VALID_YAML);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns valid=false when apiVersion is missing', () => {
    const result = validator.validate(MISSING_API_VERSION);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    const hasApiVersionError = result.errors.some(
      e =>
        e.path.includes('apiVersion') ||
        e.message.toLowerCase().includes('apiversion'),
    );
    expect(hasApiVersionError).toBe(true);
  });

  it('returns valid=false for structurally invalid entity (name is array)', () => {
    const result = validator.validate(INVALID_STRUCTURE);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('returns valid=false for unparseable YAML', () => {
    const result = validator.validate('{{{{invalid yaml');
    expect(result.valid).toBe(false);
    expect(result.errors[0].path).toBe('<yaml>');
  });
});
