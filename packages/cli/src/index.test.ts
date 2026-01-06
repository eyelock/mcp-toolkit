import { describe, expect, it } from "vitest";
import { run } from "./index.js";

describe("CLI index exports", () => {
  it("exports run function from oclif/core", () => {
    expect(run).toBeDefined();
    expect(typeof run).toBe("function");
  });
});
