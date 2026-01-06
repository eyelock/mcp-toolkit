import { describe, expect, it } from "vitest";
import { createServer } from "./server.js";

describe("createServer", () => {
  it("creates a server with default config", () => {
    const server = createServer();
    expect(server).toBeDefined();
  });

  it("creates a server with custom name and version", () => {
    const server = createServer({
      name: "test-server",
      version: "1.0.0",
    });
    expect(server).toBeDefined();
  });
});
