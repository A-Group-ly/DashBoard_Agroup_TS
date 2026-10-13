import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { centsToDecimal, percentageChange, toCents } from "../shared/money";
import { ROLES, can } from "../shared/permissions";

describe("money", () => {
  it("converts decimal strings to cents without float errors", () => {
    assert.equal(toCents("0.10") + toCents("0.20"), 30n);
    assert.equal(toCents("1250.5"), 125050n);
    assert.equal(toCents("-3.07"), -307n);
    assert.equal(toCents(null), 0n);
    assert.equal(toCents("0"), 0n);
  });

  it("formats cents back to a decimal string", () => {
    assert.equal(centsToDecimal(125050n), "1250.50");
    assert.equal(centsToDecimal(-5n), "-0.05");
    assert.equal(centsToDecimal(0n), "0.00");
  });

  it("rejects garbage", () => {
    assert.throws(() => toCents("12,50"));
  });

  it("computes percentage change", () => {
    assert.equal(percentageChange(150, 100), 50);
    assert.equal(percentageChange(50n, 100n), -50);
    assert.equal(percentageChange(-50, -100), 50);
    assert.equal(percentageChange(0, 0), 0);
    assert.equal(percentageChange(10, 0), null);
  });
});

describe("permissions", () => {
  it("gives every role dashboard access", () => {
    for (const role of ROLES) assert.ok(can(role, "dashboard:view"));
  });

  it("hides money from support", () => {
    assert.equal(can("SUPPORT", "finance:view"), false);
    assert.equal(can("SUPPORT", "finance:export"), false);
  });

  it("lets only super admins manage the team", () => {
    assert.ok(can("SUPER_ADMIN", "team:manage"));
    assert.equal(can("FINANCE", "team:manage"), false);
    assert.equal(can("SUPPORT", "team:manage"), false);
  });
});
