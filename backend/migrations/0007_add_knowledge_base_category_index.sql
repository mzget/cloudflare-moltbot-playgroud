-- Migration number: 0007 	 2026-05-23T22:10:00.000Z

-- Index for knowledge_base to optimize queries by category (used in MCP tool)
CREATE INDEX IF NOT EXISTS idx_knowledge_base_category ON knowledge_base (category);
