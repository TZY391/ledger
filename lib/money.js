// All money is stored as integer cents (bigint in Postgres) — never floats.
// These helpers are the single place that converts between cents and the
// display string, so rounding bugs can't creep in from having this logic
// duplicated across components.

export const fmt = (cents) =>
  ((cents ?? 0) / 100).toLocaleString("en-SG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// Safe calculator-expression evaluator for the amount input (6 + 2 + 2, etc).
// Strips everything except digits/operators/brackets before evaluating, so
// this can never execute arbitrary code — it's arithmetic only.
export function evalExpr(expr) {
  const cleaned = expr
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/[^0-9+\-*/().]/g, "");
  if (!cleaned) return 0;
  try {
    // eslint-disable-next-line no-new-func
    const val = Function(`"use strict"; return (${cleaned})`)();
    return typeof val === "number" && isFinite(val) ? val : 0;
  } catch {
    return 0;
  }
}

export const toCents = (expr) => Math.round(evalExpr(expr) * 100);
