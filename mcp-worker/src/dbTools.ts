import { tool } from "ai";
import { z } from "zod";
import { isSelectQuery, isValidTableName } from "./sqlGuards";

const MAX_SELECT_ROWS = 100;
const R2_NOT_BOUND = "R2 bucket is not configured or bound to the worker.";

/** Wrap an R2 tool body with the shared bucket-binding guard and error formatting. */
function r2Guard<A>(
  env: any,
  failureLabel: string,
  run: (bucket: any, args: A) => Promise<unknown>,
  notBoundMessage = R2_NOT_BOUND
) {
  return async (args: A) => {
    if (!env.BUCKET) return { error: notBoundMessage };
    try {
      return await run(env.BUCKET, args);
    } catch (e: any) {
      return { error: `${failureLabel}: ${e.message}` };
    }
  };
}

/** Build the D1 + R2 tool set for the database agent. */
export function createDbTools(env: any) {
  return {
    list_d1_tables: tool({
      description: "List all database tables in the D1 SQLite database.",
      parameters: z.object({}),
      execute: async () => {
        try {
          const { results } = await env.DB.prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
          ).all();
          return { tables: results.map((r: any) => r.name) };
        } catch (e: any) {
          return { error: `Failed to list tables: ${e.message}` };
        }
      }
    } as any) as any,
    get_d1_table_schema: tool({
      description: "Get the column definitions and details (schema) of a D1 database table.",
      parameters: z.object({
        table: z.string().describe("The name of the table to inspect")
      }),
      execute: async ({ table }: any) => {
        if (!isValidTableName(table)) {
          return { error: `Invalid table name: ${table}` };
        }
        try {
          const { results } = await env.DB.prepare(`PRAGMA table_info(${table})`).all();
          return { table, schema: results };
        } catch (e: any) {
          return { error: `Failed to get schema for table ${table}: ${e.message}` };
        }
      }
    } as any) as any,
    execute_d1_sql: tool({
      description: "Execute a raw SQL query or command against the D1 database. Supports SELECT, INSERT, UPDATE, DELETE, and DDL commands. SELECT queries will be truncated to 100 rows maximum.",
      parameters: z.object({
        sql: z.string().describe("The exact SQL command or query to execute")
      }),
      execute: async ({ sql }: any) => {
        try {
          const statement = env.DB.prepare(sql);
          if (isSelectQuery(sql)) {
            const { results } = await statement.all();
            return {
              success: true,
              results: results.slice(0, MAX_SELECT_ROWS),
              truncated: results.length > MAX_SELECT_ROWS
            };
          }
          const info = await statement.run();
          return {
            success: true,
            changes: info.meta.changes,
            duration: info.meta.duration,
            lastRowId: info.meta.last_row_id
          };
        } catch (e: any) {
          return { success: false, error: e.message };
        }
      }
    } as any) as any,
    list_r2_objects: tool({
      description: "List keys, sizes, and metadata of all objects stored in the Cloudflare R2 bucket.",
      parameters: z.object({
        prefix: z.string().optional().describe("Filter objects starting with this prefix"),
        limit: z.number().optional().describe("Maximum number of objects to list")
      }),
      execute: r2Guard(
        env,
        "Failed to list R2 objects",
        async (bucket, { prefix, limit }: any) => {
          const list = await bucket.list({ prefix, limit: limit || MAX_SELECT_ROWS });
          return {
            success: true,
            objects: list.objects.map((o: any) => ({
              key: o.key,
              size: o.size,
              uploaded: o.uploaded
            }))
          };
        },
        "R2 bucket is not configured or bound to the worker. Please configure R2 bucket binding BUCKET in wrangler.toml."
      )
    } as any) as any,
    get_r2_object: tool({
      description: "Get metadata and read text or JSON content from a specific object in the Cloudflare R2 bucket.",
      parameters: z.object({
        key: z.string().describe("The key of the object to retrieve")
      }),
      execute: r2Guard(env, "Failed to get R2 object", async (bucket, { key }: any) => {
        const object = await bucket.get(key);
        if (!object) {
          return { error: `Object with key '${key}' not found.` };
        }
        const text = await object.text();
        let body: any = text;
        try {
          body = JSON.parse(text);
        } catch (_) {}
        return {
          key: object.key,
          size: object.size,
          uploaded: object.uploaded,
          httpMetadata: object.httpMetadata,
          content: body
        };
      })
    } as any) as any,
    put_r2_object: tool({
      description: "Upload or overwrite text or JSON content to a key in the Cloudflare R2 bucket.",
      parameters: z.object({
        key: z.string().describe("The key under which to save the object"),
        content: z.string().describe("The text or JSON string content to upload"),
        contentType: z.string().optional().describe("Optional HTTP Content-Type header (e.g. 'application/json', 'text/plain')")
      }),
      execute: r2Guard(env, "Failed to upload R2 object", async (bucket, { key, content, contentType }: any) => {
        const options: any = contentType ? { httpMetadata: { contentType } } : {};
        const object = await bucket.put(key, content, options);
        return {
          success: true,
          key: object.key,
          size: object.size,
          uploaded: object.uploaded
        };
      })
    } as any) as any,
    delete_r2_object: tool({
      description: "Delete an object key from the Cloudflare R2 bucket.",
      parameters: z.object({
        key: z.string().describe("The key of the object to delete")
      }),
      execute: r2Guard(env, "Failed to delete R2 object", async (bucket, { key }: any) => {
        await bucket.delete(key);
        return { success: true, message: `Object '${key}' deleted successfully.` };
      })
    } as any) as any,
  };
}
