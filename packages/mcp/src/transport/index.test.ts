import { describe, expect, it } from "vitest";
import { parseTransportArgs } from "./index.js";

describe("Transport", () => {
  describe("parseTransportArgs", () => {
    it("defaults to stdio mode with no args", () => {
      const options = parseTransportArgs([]);

      expect(options.mode).toBe("stdio");
      expect(options.httpConfig).toBeUndefined();
    });

    it("defaults to stdio mode with --stdio flag", () => {
      const options = parseTransportArgs(["--stdio"]);

      expect(options.mode).toBe("stdio");
    });

    it("returns http mode with --http flag", () => {
      const options = parseTransportArgs(["--http"]);

      expect(options.mode).toBe("http");
      expect(options.httpConfig).toBeDefined();
    });

    it("uses default port 3000 for http mode", () => {
      const options = parseTransportArgs(["--http"]);

      expect(options.httpConfig?.port).toBe(3000);
    });

    it("uses default host localhost for http mode", () => {
      const options = parseTransportArgs(["--http"]);

      expect(options.httpConfig?.host).toBe("localhost");
    });

    it("parses custom port", () => {
      const options = parseTransportArgs(["--http", "--port", "8080"]);

      expect(options.httpConfig?.port).toBe(8080);
    });

    it("parses custom host", () => {
      const options = parseTransportArgs(["--http", "--host", "0.0.0.0"]);

      expect(options.httpConfig?.host).toBe("0.0.0.0");
    });

    it("parses auth token", () => {
      const options = parseTransportArgs(["--http", "--token", "secret123"]);

      expect(options.httpConfig?.authToken).toBe("secret123");
    });

    it("parses all http options together", () => {
      const options = parseTransportArgs([
        "--http",
        "--port",
        "9000",
        "--host",
        "127.0.0.1",
        "--token",
        "mytoken",
      ]);

      expect(options.mode).toBe("http");
      expect(options.httpConfig?.port).toBe(9000);
      expect(options.httpConfig?.host).toBe("127.0.0.1");
      expect(options.httpConfig?.authToken).toBe("mytoken");
    });

    it("ignores http options without --http flag", () => {
      const options = parseTransportArgs(["--port", "8080"]);

      expect(options.mode).toBe("stdio");
      expect(options.httpConfig).toBeUndefined();
    });

    it("handles missing port value gracefully", () => {
      const options = parseTransportArgs(["--http", "--port"]);

      expect(options.httpConfig?.port).toBe(3000); // defaults to 3000 when parseInt fails
    });

    it("handles missing host value", () => {
      const options = parseTransportArgs(["--http", "--host"]);

      expect(options.httpConfig?.host).toBeUndefined();
    });

    it("handles missing token value", () => {
      const options = parseTransportArgs(["--http", "--token"]);

      expect(options.httpConfig?.authToken).toBeUndefined();
    });
  });
});
