import { describe, expect, it } from "vitest";
import { safeError, textField, uuid } from "./errors";
describe("trust-boundary failures", () => {
  it("does not expose database messages or target information", () => {
    expect(safeError({ code: "40001" })).toContain("record changed");
    expect(safeError({ code: "unknown" })).toContain("could not be confirmed");
  });
  it("rejects files and oversized fields and accepts opaque UUIDs", () => {
    const form = new FormData();
    form.set("name", new Blob(["secret"]), "file.txt");
    expect(textField(form, "name", 100)).toBe("");
    form.set("name", "x".repeat(101));
    expect(textField(form, "name", 100)).toBe("");
    expect(uuid.test("30000000-0000-0000-0000-000000000001")).toBe(true);
    expect(uuid.test("../other-staff")).toBe(false);
  });
});
