import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { TV_STRINGS, format } from "../src/lib/tvStrings";

describe("TV mode text", () => {
  it("has every English string in Arabic too", () => {
    const en = Object.keys(TV_STRINGS.en).sort();
    const ar = Object.keys(TV_STRINGS.ar).sort();
    assert.deepEqual(ar, en);
    for (const key of en) assert.ok(TV_STRINGS.ar[key as keyof typeof TV_STRINGS.ar].trim(), `empty: ${key}`);
  });

  it("keeps the same placeholders in both languages", () => {
    const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort().join(",");
    for (const key of Object.keys(TV_STRINGS.en) as (keyof typeof TV_STRINGS.en)[]) {
      assert.equal(placeholders(TV_STRINGS.ar[key]), placeholders(TV_STRINGS.en[key]), key);
    }
  });

  it("fills placeholders", () => {
    assert.equal(format("Bills due by {date}: {n}", { date: "31 Oct", n: 2 }), "Bills due by 31 Oct: 2");
  });
});
