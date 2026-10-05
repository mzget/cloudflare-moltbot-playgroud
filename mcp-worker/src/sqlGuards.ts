const TABLE_NAME_PATTERN = /^[a-zA-Z0-9_]+$/;

/** Pure: true when the SQL statement is a SELECT query. */
export const isSelectQuery = (sql: string): boolean => sql.trim().toLowerCase().startsWith("select");

export const isValidTableName = (table: string): boolean => TABLE_NAME_PATTERN.test(table);
