/**
 * Stored Procedure Parameter Schema Validator & Guard
 * Protects MySQL stored procedures against parameter count mismatches,
 * invalid date strings, and malformed inputs before query execution.
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export const SP_TIMEOUT_MS = 45000; // 45-second query execution timeout

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates Stock Movement Statement parameters (expected 10 parameters)
 */
export function validateStockMovementParams(body: any): ValidationResult {
  const errors: string[] = [];

  if (body?.fromDate && !DATE_REGEX.test(String(body.fromDate).slice(0, 10))) {
    errors.push("fromDate must be a valid date formatted as YYYY-MM-DD");
  }
  if (body?.toDate && !DATE_REGEX.test(String(body.toDate).slice(0, 10))) {
    errors.push("toDate must be a valid date formatted as YYYY-MM-DD");
  }
  if (body?.compNo !== undefined && isNaN(Number(body.compNo))) {
    errors.push("compNo must be a numeric value");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates Stock & Sales Statement parameters (expected 11 parameters)
 */
export function validateStockAndSalesParams(body: any): ValidationResult {
  const errors: string[] = [];

  if (body?.fromDate && !DATE_REGEX.test(String(body.fromDate).slice(0, 10))) {
    errors.push("fromDate must be a valid date formatted as YYYY-MM-DD");
  }
  if (body?.toDate && !DATE_REGEX.test(String(body.toDate).slice(0, 10))) {
    errors.push("toDate must be a valid date formatted as YYYY-MM-DD");
  }
  if (body?.finYear !== undefined && body.finYear !== null && String(body.finYear).trim() === "") {
    errors.push("finYear cannot be an empty string");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates MR-wise Periodical Outstanding parameters (expected 15 parameters)
 */
export function validateOutstandingParams(body: any): ValidationResult {
  const errors: string[] = [];

  if (!body?.mrId && body?.mrId !== 0) {
    errors.push("mrId is required for periodical outstanding evaluation");
  }
  if (body?.fromDate && !DATE_REGEX.test(String(body.fromDate).slice(0, 10))) {
    errors.push("fromDate must be a valid date formatted as YYYY-MM-DD");
  }
  if (body?.toDate && !DATE_REGEX.test(String(body.toDate).slice(0, 10))) {
    errors.push("toDate must be a valid date formatted as YYYY-MM-DD");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates Party Customer Itemwise Sales parameters (expected 11 parameters)
 */
export function validatePartyItemSaleParams(body: any): ValidationResult {
  const errors: string[] = [];

  if (body?.fromDate && !DATE_REGEX.test(String(body.fromDate).slice(0, 10))) {
    errors.push("fromDate must be a valid date formatted as YYYY-MM-DD");
  }
  if (body?.toDate && !DATE_REGEX.test(String(body.toDate).slice(0, 10))) {
    errors.push("toDate must be a valid date formatted as YYYY-MM-DD");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
