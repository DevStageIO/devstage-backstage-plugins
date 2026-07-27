/**
 * SchemaValidator: wraps `@backstage/catalog-model`'s `entitySchemaValidator`
 * to provide a simple validate(yamlString) interface.
 *
 * Used by the /suggestions endpoint before returning YAML to callers, and
 * exposed for the frontend modal preview (T08).
 */

import { entitySchemaValidator } from '@backstage/catalog-model';
import * as yaml from 'js-yaml';

/** One schema validation error with a JSON-path pointer and human message. */
export type ValidationError = {
  path: string;
  message: string;
};

/** Result returned by `SchemaValidator.validate`. */
export type ValidationResult = {
  valid: boolean;
  errors: Array<ValidationError>;
};

/** Validator function returned by catalog-model. */
const validate = entitySchemaValidator();

/** Extract structured errors from the validator exception. */
const extractErrors = (err: unknown): Array<ValidationError> => {
  if (err && typeof err === 'object' && 'errors' in err) {
    const raw = (err as { errors: unknown }).errors;
    if (Array.isArray(raw)) {
      return raw.map((e: unknown) => {
        if (e && typeof e === 'object') {
          const rec = e as Record<string, unknown>;
          return {
            path: String(rec.instancePath ?? rec.dataPath ?? ''),
            message: String(rec.message ?? 'schema validation failed'),
          };
        }
        return { path: '', message: String(e) };
      });
    }
  }
  return [
    { path: '', message: (err as Error).message ?? 'schema validation failed' },
  ];
};

/**
 * SchemaValidator parses a YAML string and validates the resulting object
 * against the Backstage Entity schema.
 */
export class SchemaValidator {
  /**
   * Parse `yamlString` and run it through the Backstage entity schema
   * validator. Returns `{ valid: true, errors: [] }` on success.
   */
  validate(yamlString: string): ValidationResult {
    let parsed: unknown;
    try {
      parsed = yaml.load(yamlString);
    } catch (err) {
      return {
        valid: false,
        errors: [{ path: '<yaml>', message: (err as Error).message }],
      };
    }

    try {
      validate(parsed);
      return { valid: true, errors: [] };
    } catch (err) {
      const errors = extractErrors(err);
      return { valid: false, errors };
    }
  }
}
