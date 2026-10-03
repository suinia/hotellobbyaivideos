import assert from "node:assert/strict";
import { test } from "node:test";
import { safeReturnPath } from "../src/lib/auth/safe-return-path";
test("authentication preserves the annual checkout query", () => {
  const next = "/pricing?checkout=1&package=pro_annual_v19&pricing_variant=1.9";
  assert.equal(safeReturnPath(next), next);
});
test("rejects external redirects including browser URL normalization tricks", () => {
  for (const next of ["https://other.test", "//other.test", "/\\other.test", "/\t/other.test", "javascript:alert(1)", "", null]) {
    assert.equal(safeReturnPath(next), "/");
  }
});
test("normalizes a local path while preserving query and anchor", () => {
  assert.equal(safeReturnPath("/guides/../pricing?next=%2F#plans"), "/pricing?next=%2F#plans");
});
