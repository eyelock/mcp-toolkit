/**
 * Pagination Tests
 */

import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAGE_SIZE,
  InvalidCursorError,
  createPaginatedResponse,
  decodeCursor,
  encodeCursor,
  paginateResults,
} from "./pagination.js";

describe("Pagination", () => {
  describe("encodeCursor / decodeCursor", () => {
    it("should encode and decode cursor round-trip", () => {
      const cursor = { offset: 100, pageSize: 50 };
      const encoded = encodeCursor(cursor);
      const decoded = decodeCursor(encoded);

      expect(decoded).toEqual(cursor);
    });

    it("should produce opaque base64 string", () => {
      const cursor = { offset: 0, pageSize: 100 };
      const encoded = encodeCursor(cursor);

      // Should be valid base64
      expect(() => Buffer.from(encoded, "base64")).not.toThrow();
      // Should not be human-readable
      expect(encoded).not.toContain("offset");
    });

    it("should throw InvalidCursorError for invalid base64", () => {
      expect(() => decodeCursor("not-valid-base64!!!")).toThrow(InvalidCursorError);
    });

    it("should throw InvalidCursorError for invalid JSON", () => {
      const invalidJson = Buffer.from("not json").toString("base64");
      expect(() => decodeCursor(invalidJson)).toThrow(InvalidCursorError);
    });

    it("should throw InvalidCursorError for missing fields", () => {
      const missingFields = Buffer.from(JSON.stringify({ offset: 0 })).toString("base64");
      expect(() => decodeCursor(missingFields)).toThrow(InvalidCursorError);
    });

    it("should throw InvalidCursorError for negative offset", () => {
      const negative = Buffer.from(JSON.stringify({ offset: -1, pageSize: 10 })).toString("base64");
      expect(() => decodeCursor(negative)).toThrow(InvalidCursorError);
    });

    it("should throw InvalidCursorError for zero pageSize", () => {
      const zeroPage = Buffer.from(JSON.stringify({ offset: 0, pageSize: 0 })).toString("base64");
      expect(() => decodeCursor(zeroPage)).toThrow(InvalidCursorError);
    });
  });

  describe("paginateResults", () => {
    const testItems = Array.from({ length: 250 }, (_, i) => ({ id: i, name: `Item ${i}` }));

    it("should return first page with default page size", () => {
      const result = paginateResults(testItems);

      expect(result.items).toHaveLength(DEFAULT_PAGE_SIZE);
      expect(result.items[0]).toEqual({ id: 0, name: "Item 0" });
      expect(result.nextCursor).toBeDefined();
    });

    it("should return second page using cursor", () => {
      const page1 = paginateResults(testItems);
      const page2 = paginateResults(testItems, page1.nextCursor);

      expect(page2.items).toHaveLength(DEFAULT_PAGE_SIZE);
      expect(page2.items[0]).toEqual({ id: 100, name: "Item 100" });
      expect(page2.nextCursor).toBeDefined();
    });

    it("should return last page without nextCursor", () => {
      const page1 = paginateResults(testItems);
      const page2 = paginateResults(testItems, page1.nextCursor);
      const page3 = paginateResults(testItems, page2.nextCursor);

      expect(page3.items).toHaveLength(50); // 250 - 200 = 50
      expect(page3.nextCursor).toBeUndefined();
    });

    it("should respect custom page size", () => {
      const result = paginateResults(testItems, undefined, { pageSize: 10 });

      expect(result.items).toHaveLength(10);
      expect(result.nextCursor).toBeDefined();
    });

    it("should include total when requested", () => {
      const result = paginateResults(testItems, undefined, { includeTotal: true });

      expect(result.total).toBe(250);
    });

    it("should not include total by default", () => {
      const result = paginateResults(testItems);

      expect(result.total).toBeUndefined();
    });

    it("should handle empty array", () => {
      const result = paginateResults([]);

      expect(result.items).toHaveLength(0);
      expect(result.nextCursor).toBeUndefined();
    });

    it("should handle array smaller than page size", () => {
      const smallArray = [1, 2, 3];
      const result = paginateResults(smallArray);

      expect(result.items).toEqual([1, 2, 3]);
      expect(result.nextCursor).toBeUndefined();
    });

    it("should handle exact page size boundary", () => {
      const exactSize = Array.from({ length: 100 }, (_, i) => i);
      const result = paginateResults(exactSize);

      expect(result.items).toHaveLength(100);
      expect(result.nextCursor).toBeUndefined();
    });

    it("should maintain cursor page size across pages", () => {
      const page1 = paginateResults(testItems, undefined, { pageSize: 25 });
      const page2 = paginateResults(testItems, page1.nextCursor);

      // Page 2 should use the page size from the cursor (25), not default
      expect(page2.items).toHaveLength(25);
      expect(page2.items[0]).toEqual({ id: 25, name: "Item 25" });
    });
  });

  describe("createPaginatedResponse", () => {
    it("should return object with nextCursor when provided", () => {
      const response = createPaginatedResponse("some-cursor");

      expect(response).toEqual({ nextCursor: "some-cursor" });
    });

    it("should return empty object when no cursor", () => {
      const response = createPaginatedResponse(undefined);

      expect(response).toEqual({});
    });

    it("should be spreadable into resource response", () => {
      const items = [1, 2, 3];
      const nextCursor = "test-cursor";

      const resourceResponse = {
        contents: [{ uri: "test://resource", text: JSON.stringify(items) }],
        ...createPaginatedResponse(nextCursor),
      };

      expect(resourceResponse.nextCursor).toBe("test-cursor");
    });
  });
});
