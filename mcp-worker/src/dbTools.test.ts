import { describe, it, expect, vi } from "vitest";
import { createFakeDb } from "./testHelpers";

vi.mock("ai", () => ({ tool: (def: unknown) => def }));

import { createDbTools } from "./dbTools";

const run = (tools: any, name: string, args: unknown = {}) => tools[name].execute(args);

describe("D1 tools", () => {
  it("list_d1_tables returns table names and handles failure", async () => {
    const { db } = createFakeDb({ results: [{ name: "a" }, { name: "b" }] });
    expect(await run(createDbTools({ DB: db }), "list_d1_tables")).toEqual({ tables: ["a", "b"] });
    const bad = createFakeDb({ failOn: /sqlite_master/ }).db;
    expect(await run(createDbTools({ DB: bad }), "list_d1_tables")).toEqual({ error: "Failed to list tables: db failure" });
  });

  it("get_d1_table_schema validates the name, returns schema, handles failure", async () => {
    const { db, calls } = createFakeDb({ results: [{ cid: 0 }] });
    const tools = createDbTools({ DB: db });
    expect(await run(tools, "get_d1_table_schema", { table: "bad; DROP" })).toEqual({ error: "Invalid table name: bad; DROP" });
    expect(calls).toHaveLength(0);
    expect(await run(tools, "get_d1_table_schema", { table: "users" })).toEqual({ table: "users", schema: [{ cid: 0 }] });
    expect(calls[0].sql).toBe("PRAGMA table_info(users)");
    const bad = createFakeDb({ failOn: /PRAGMA/ }).db;
    const res = await run(createDbTools({ DB: bad }), "get_d1_table_schema", { table: "users" });
    expect(res.error).toContain("Failed to get schema for table users");
  });

  it("execute_d1_sql returns rows for SELECT and truncates at 100", async () => {
    const rows = Array.from({ length: 150 }, (_, i) => ({ i }));
    const { db } = createFakeDb({ results: rows });
    const res = await run(createDbTools({ DB: db }), "execute_d1_sql", { sql: "  SELECT * FROM t" });
    expect(res.success).toBe(true);
    expect(res.results).toHaveLength(100);
    expect(res.truncated).toBe(true);
  });

  it("execute_d1_sql does not flag small SELECT results as truncated", async () => {
    const { db } = createFakeDb({ results: [{ a: 1 }] });
    const res = await run(createDbTools({ DB: db }), "execute_d1_sql", { sql: "select 1" });
    expect(res).toEqual({ success: true, results: [{ a: 1 }], truncated: false });
  });

  it("execute_d1_sql returns meta for writes and errors on failure", async () => {
    const { db } = createFakeDb();
    expect(await run(createDbTools({ DB: db }), "execute_d1_sql", { sql: "DELETE FROM t" })).toEqual({
      success: true, changes: 1, duration: 2, lastRowId: 3,
    });
    const bad = createFakeDb({ failOn: /./ }).db;
    expect(await run(createDbTools({ DB: bad }), "execute_d1_sql", { sql: "DROP TABLE t" })).toEqual({
      success: false, error: "db failure",
    });
  });
});

describe("R2 tools", () => {
  const bucket = () => ({
    list: vi.fn().mockResolvedValue({ objects: [{ key: "k", size: 1, uploaded: "u", extra: "x" }] }),
    get: vi.fn(),
    put: vi.fn().mockResolvedValue({ key: "k", size: 3, uploaded: "u" }),
    delete: vi.fn().mockResolvedValue(undefined),
  });
  const names = ["list_r2_objects", "get_r2_object", "put_r2_object", "delete_r2_object"];

  it.each(names)("%s reports a missing bucket binding", async (name) => {
    const res = await run(createDbTools({}), name, { key: "k" });
    expect(res.error).toContain("R2 bucket is not configured");
  });

  it("list_r2_objects mentions wrangler.toml and defaults limit to 100", async () => {
    expect((await run(createDbTools({}), "list_r2_objects")).error).toContain("wrangler.toml");
    const b = bucket();
    const res = await run(createDbTools({ BUCKET: b }), "list_r2_objects", { prefix: "p/" });
    expect(b.list).toHaveBeenCalledWith({ prefix: "p/", limit: 100 });
    expect(res.objects).toEqual([{ key: "k", size: 1, uploaded: "u" }]);
    await run(createDbTools({ BUCKET: b }), "list_r2_objects", { limit: 5 });
    expect(b.list).toHaveBeenLastCalledWith({ prefix: undefined, limit: 5 });
  });

  it("get_r2_object parses JSON, returns text, handles missing key", async () => {
    const b = bucket();
    const tools = createDbTools({ BUCKET: b });
    b.get.mockResolvedValueOnce({ key: "k", size: 1, uploaded: "u", httpMetadata: {}, text: async () => '{"a":1}' });
    expect((await run(tools, "get_r2_object", { key: "k" })).content).toEqual({ a: 1 });
    b.get.mockResolvedValueOnce({ key: "k", size: 1, uploaded: "u", httpMetadata: {}, text: async () => "plain" });
    expect((await run(tools, "get_r2_object", { key: "k" })).content).toBe("plain");
    b.get.mockResolvedValueOnce(null);
    expect(await run(tools, "get_r2_object", { key: "nope" })).toEqual({ error: "Object with key 'nope' not found." });
  });

  it("put_r2_object passes content type only when provided", async () => {
    const b = bucket();
    const tools = createDbTools({ BUCKET: b });
    await run(tools, "put_r2_object", { key: "k", content: "c", contentType: "text/plain" });
    expect(b.put).toHaveBeenLastCalledWith("k", "c", { httpMetadata: { contentType: "text/plain" } });
    const res = await run(tools, "put_r2_object", { key: "k", content: "c" });
    expect(b.put).toHaveBeenLastCalledWith("k", "c", {});
    expect(res).toEqual({ success: true, key: "k", size: 3, uploaded: "u" });
  });

  it("delete_r2_object deletes the key", async () => {
    const b = bucket();
    expect(await run(createDbTools({ BUCKET: b }), "delete_r2_object", { key: "k" })).toEqual({
      success: true, message: "Object 'k' deleted successfully.",
    });
    expect(b.delete).toHaveBeenCalledWith("k");
  });

  it.each([
    ["list_r2_objects", "list", "Failed to list R2 objects"],
    ["get_r2_object", "get", "Failed to get R2 object"],
    ["put_r2_object", "put", "Failed to upload R2 object"],
    ["delete_r2_object", "delete", "Failed to delete R2 object"],
  ])("%s wraps bucket errors", async (name, method, label) => {
    const b: any = bucket();
    b[method].mockRejectedValue(new Error("r2 down"));
    const res = await run(createDbTools({ BUCKET: b }), name, { key: "k", content: "c" });
    expect(res).toEqual({ error: `${label}: r2 down` });
  });
});

