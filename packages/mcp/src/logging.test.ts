/**
 * Logging Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  Logger,
  StderrTransport,
  LogLevel,
  getLogger,
  configureLogger,
  logDebug,
  logInfo,
  logWarning,
  logError,
  logToolRequest,
  logResourceAccess,
  logServerEvent,
  LogDataSchema,
  LogMessageSchema,
} from "./logging.js";

describe("Logging", () => {
  describe("LogLevel", () => {
    it("should validate valid log levels", () => {
      expect(LogLevel.parse("debug")).toBe("debug");
      expect(LogLevel.parse("info")).toBe("info");
      expect(LogLevel.parse("notice")).toBe("notice");
      expect(LogLevel.parse("warning")).toBe("warning");
      expect(LogLevel.parse("error")).toBe("error");
      expect(LogLevel.parse("critical")).toBe("critical");
      expect(LogLevel.parse("alert")).toBe("alert");
      expect(LogLevel.parse("emergency")).toBe("emergency");
    });

    it("should reject invalid log levels", () => {
      expect(() => LogLevel.parse("invalid")).toThrow();
      expect(() => LogLevel.parse("warn")).toThrow(); // RFC 5424 uses 'warning'
    });
  });

  describe("StderrTransport", () => {
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it("should write to stderr as JSON", () => {
      const transport = new StderrTransport();
      transport.write({
        level: "info",
        logger: "test",
        data: { message: "Test message" },
      });

      expect(consoleSpy).toHaveBeenCalledOnce();
      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(output.level).toBe("info");
      expect(output.logger).toBe("test");
      expect(output.message).toBe("Test message");
      expect(output.timestamp).toBeDefined();
    });

    it("should respect minLevel", () => {
      const transport = new StderrTransport({ minLevel: "warning" });
      expect(transport.minLevel).toBe("warning");
    });

    it("should be disableable", () => {
      const transport = new StderrTransport({ enabled: false });
      transport.write({
        level: "info",
        data: { message: "Should not appear" },
      });

      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it("should allow runtime level changes", () => {
      const transport = new StderrTransport({ minLevel: "info" });
      expect(transport.minLevel).toBe("info");

      transport.setMinLevel("debug");
      expect(transport.minLevel).toBe("debug");
    });
  });

  describe("Logger", () => {
    let mockTransport: {
      name: string;
      minLevel: LogLevel;
      write: ReturnType<typeof vi.fn>;
      setMinLevel: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      mockTransport = {
        name: "mock",
        minLevel: "debug",
        write: vi.fn(),
        setMinLevel: vi.fn(),
      };
    });

    it("should dispatch to transports", () => {
      const logger = new Logger({ transports: [mockTransport] });
      logger.info("Test message");

      expect(mockTransport.write).toHaveBeenCalledOnce();
      const message = mockTransport.write.mock.calls[0][0];
      expect(message.level).toBe("info");
      expect(message.data.message).toBe("Test message");
    });

    it("should use default logger name", () => {
      const logger = new Logger({
        defaultLogger: "custom-logger",
        transports: [mockTransport],
      });
      logger.info("Test");

      const message = mockTransport.write.mock.calls[0][0];
      expect(message.logger).toBe("custom-logger");
    });

    it("should filter by minLevel", () => {
      mockTransport.minLevel = "warning";
      const logger = new Logger({ transports: [mockTransport] });

      logger.debug("Should not appear");
      logger.info("Should not appear");
      logger.warning("Should appear");

      expect(mockTransport.write).toHaveBeenCalledOnce();
    });

    it("should include error details", () => {
      const logger = new Logger({ transports: [mockTransport] });
      const error = new Error("Test error");
      error.name = "TestError";

      logger.error("Operation failed", error);

      const message = mockTransport.write.mock.calls[0][0];
      expect(message.data.error).toBeDefined();
      expect(message.data.error.message).toBe("Test error");
      expect(message.data.error.name).toBe("TestError");
    });

    it("should support all RFC 5424 levels", () => {
      const logger = new Logger({ transports: [mockTransport] });

      logger.debug("debug");
      logger.info("info");
      logger.notice("notice");
      logger.warning("warning");
      logger.error("error");
      logger.critical("critical");
      logger.alert("alert");
      logger.emergency("emergency");

      expect(mockTransport.write).toHaveBeenCalledTimes(8);
    });

    it("should add and remove transports", () => {
      const logger = new Logger();
      logger.addTransport(mockTransport);
      expect(logger.getTransport("mock")).toBe(mockTransport);

      logger.removeTransport("mock");
      expect(logger.getTransport("mock")).toBeUndefined();
    });
  });

  describe("Global logger functions", () => {
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      // Ensure logging is enabled
      configureLogger({ enabled: true, minLevel: "debug" });
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it("logDebug should log at debug level", () => {
      logDebug("Debug message");
      expect(consoleSpy).toHaveBeenCalled();
      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(output.level).toBe("debug");
    });

    it("logInfo should log at info level", () => {
      logInfo("Info message");
      expect(consoleSpy).toHaveBeenCalled();
      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(output.level).toBe("info");
    });

    it("logWarning should log at warning level", () => {
      logWarning("Warning message");
      expect(consoleSpy).toHaveBeenCalled();
      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(output.level).toBe("warning");
    });

    it("logError should log at error level with error details", () => {
      const error = new Error("Test");
      logError("Error occurred", error);
      expect(consoleSpy).toHaveBeenCalled();
      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(output.level).toBe("error");
      expect(output.error.message).toBe("Test");
    });
  });

  describe("Specialized logging functions", () => {
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      configureLogger({ enabled: true, minLevel: "debug" });
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it("logToolRequest should include tool timing", () => {
      logToolRequest("test_tool", true, 150, { sessionId: "sess-123" });

      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(output.tool).toBe("test_tool");
      expect(output.durationMs).toBe(150);
      expect(output.sessionId).toBe("sess-123");
      expect(output.logger).toBe("tools");
    });

    it("logToolRequest should log errors on failure", () => {
      const error = new Error("Tool failed");
      logToolRequest("test_tool", false, 50, { error });

      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(output.level).toBe("error");
      expect(output.error.message).toBe("Tool failed");
    });

    it("logResourceAccess should include resource info", () => {
      logResourceAccess("session://current", true, 25);

      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(output.resource).toBe("session://current");
      expect(output.durationMs).toBe(25);
      expect(output.logger).toBe("resources");
    });

    it("logServerEvent should include event type", () => {
      logServerEvent("startup", "Server started successfully");

      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(output.message).toBe("Server started successfully");
      expect(output.metadata.event).toBe("startup");
      expect(output.logger).toBe("server");
    });
  });

  describe("Schema validation", () => {
    it("LogDataSchema should validate correct data", () => {
      const result = LogDataSchema.safeParse({
        message: "Test message",
        timestamp: "2024-01-01T00:00:00Z",
        tool: "test_tool",
        durationMs: 100,
      });

      expect(result.success).toBe(true);
    });

    it("LogDataSchema should require message", () => {
      const result = LogDataSchema.safeParse({
        timestamp: "2024-01-01T00:00:00Z",
      });

      expect(result.success).toBe(false);
    });

    it("LogMessageSchema should validate complete message", () => {
      const result = LogMessageSchema.safeParse({
        level: "info",
        logger: "test",
        data: { message: "Test" },
      });

      expect(result.success).toBe(true);
    });
  });

  describe("getLogger and configureLogger", () => {
    it("getLogger should return the global logger", () => {
      const logger1 = getLogger();
      const logger2 = getLogger();
      expect(logger1).toBe(logger2);
    });

    it("configureLogger should modify stderr transport", () => {
      const logger = getLogger();
      const transport = logger.getTransport("stderr") as StderrTransport;

      configureLogger({ minLevel: "error" });
      expect(transport.minLevel).toBe("error");

      // Reset to default for other tests
      configureLogger({ minLevel: "info" });
    });
  });
});
