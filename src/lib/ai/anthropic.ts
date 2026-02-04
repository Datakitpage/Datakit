import type { TableSchema } from "@/store/dataStore";
import type { ColumnSchema } from "@/store/duckDBViewStore";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

// Helper to serialize data that may contain BigInt (DuckDB returns BIGINT as JS BigInt)
const bigIntReplacer = (_: string, v: unknown): unknown =>
  typeof v === 'bigint' ? Number(v) : v;

/**
 * Validate an Anthropic API key by making a minimal request
 * Returns true if valid, throws an error with details if invalid
 */
export async function validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  if (!apiKey || !apiKey.trim()) {
    return { valid: false, error: "API key is empty" };
  }

  // Basic format check
  if (!apiKey.startsWith("sk-ant-")) {
    return { valid: false, error: "API key should start with 'sk-ant-'" };
  }

  try {
    // Make a minimal request to validate the key
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: AI_MODELS.HAIKU,
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      }),
    });

    if (response.ok) {
      return { valid: true };
    }

    // Handle specific error codes
    if (response.status === 401) {
      return { valid: false, error: "Invalid API key" };
    }
    if (response.status === 403) {
      return { valid: false, error: "API key lacks required permissions" };
    }
    if (response.status === 429) {
      // Rate limited means key is valid but over quota
      return { valid: true };
    }

    return { valid: false, error: `API error: ${response.status}` };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : "Network error" };
  }
}

// Models optimized for different use cases
export const AI_MODELS = {
  // Fast, cheap - ideal for simple tasks and quick responses
  HAIKU: "claude-3-5-haiku-20241022",
  // Smart, capable - for analysis and general tasks
  SONNET: "claude-sonnet-4-20250514",
  // Most capable - for complex SQL generation and reasoning
  OPUS: "claude-opus-4-5-20251101",
} as const;

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface DashboardSuggestion {
  widgets: Array<{
    type: "metric" | "chart" | "table";
    title: string;
    sql: string;
    config: Record<string, unknown>;
  }>;
  insights: string[];
}

export interface AIResponse {
  text: string;
  sql?: string;
  dashboardSuggestion?: DashboardSuggestion;
}

function buildSystemPrompt(schema: TableSchema[], tableName: string, sampleData?: Record<string, unknown>[]): string {
  const schemaStr = schema.map((col) => col.name + " (" + col.type + ")").join(", ");
  
  let prompt = "You are an AI assistant for OpenSheet, a data exploration application. ";
  prompt += "You help users understand their data and create visualizations.\n\n";
  prompt += "Current data table: " + tableName + "\n";
  prompt += "Schema: " + schemaStr + "\n\n";
  
  if (sampleData && sampleData.length > 0) {
    prompt += "Sample data (first 3 rows):\n";
    prompt += JSON.stringify(sampleData.slice(0, 3), bigIntReplacer, 2) + "\n\n";
  }

  prompt += "When the user asks about their data:\n";
  prompt += "1. If they want to see data or stats, generate a SQL query\n";
  prompt += "2. If they want a visualization, suggest a widget type (metric, chart, table)\n";
  prompt += "3. Always explain what you're doing in simple terms\n\n";
  
  prompt += "For SQL queries, wrap them in ```sql blocks.\n";
  prompt += "For dashboard suggestions, use this JSON format:\n";
  prompt += "```dashboard\n{\"widgets\": [...], \"insights\": [...]}\n```";
  
  return prompt;
}

function buildAutoDashboardPrompt(schema: TableSchema[], tableName: string, sampleData: Record<string, unknown>[]): string {
  const schemaStr = schema.map((col) => col.name + " (" + col.type + ")").join(", ");
  
  let prompt = "Analyze this data and suggest a dashboard layout.\n\n";
  prompt += "Table: " + tableName + "\n";
  prompt += "Schema: " + schemaStr + "\n\n";
  prompt += "Sample data:\n" + JSON.stringify(sampleData.slice(0, 5), bigIntReplacer, 2) + "\n\n";
  
  prompt += "Create a dashboard with 3-5 widgets. For each widget, provide:\n";
  prompt += "- type: 'metric' (single number), 'chart' (visualization), or 'table' (data grid)\n";
  prompt += "- title: descriptive name\n";
  prompt += "- sql: the SQL query to get the data\n";
  prompt += "- config: widget-specific configuration\n\n";
  
  prompt += "Also provide 2-3 key insights about the data.\n\n";
  prompt += "Respond ONLY with a JSON object in this exact format:\n";
  prompt += '{"widgets": [...], "insights": ["insight 1", "insight 2"]}';
  
  return prompt;
}

export async function chat(
  apiKey: string,
  messages: Message[],
  schema: TableSchema[],
  tableName: string,
  sampleData?: Record<string, unknown>[]
): Promise<AIResponse> {
  const systemPrompt = buildSystemPrompt(schema, tableName, sampleData);

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error("Anthropic API error: " + error);
  }

  const data = await response.json();
  const text = data.content[0]?.text || "";

  // Extract SQL if present
  const sqlMatch = text.match(/```sql\n([\s\S]*?)```/);
  const sql = sqlMatch ? sqlMatch[1].trim() : undefined;

  // Extract dashboard suggestion if present
  const dashboardMatch = text.match(/```dashboard\n([\s\S]*?)```/);
  let dashboardSuggestion: DashboardSuggestion | undefined;
  if (dashboardMatch) {
    try {
      dashboardSuggestion = JSON.parse(dashboardMatch[1]);
    } catch (e) {
      console.error("Failed to parse dashboard suggestion:", e);
    }
  }

  return { text, sql, dashboardSuggestion };
}

export async function generateAutoDashboard(
  apiKey: string,
  schema: TableSchema[],
  tableName: string,
  sampleData: Record<string, unknown>[]
): Promise<DashboardSuggestion | null> {
  const prompt = buildAutoDashboardPrompt(schema, tableName, sampleData);

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error("Anthropic API error: " + error);
  }

  const data = await response.json();
  const text = data.content[0]?.text || "";

  try {
    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as DashboardSuggestion;
    }
  } catch (e) {
    console.error("Failed to parse auto dashboard response:", e);
  }

  return null;
}

// ============ COMMAND ASSISTANT (Streaming) ============

export interface CommandContext {
  schema: ColumnSchema[];
  totalRows: number;
  tableName?: string;
  sampleData?: Record<string, unknown>[];
  currentFilters?: string;
  currentSort?: { column: string; direction: string };
}

export interface CommandAssistantResponse {
  text: string;
  suggestedCommand?: {
    type: string;
    command: string;
    explanation: string;
  };
}

function buildCommandSystemPrompt(context: CommandContext, tableName: string): string {
  const schemaStr = context.schema
    .filter(c => c.name !== '_rowid')
    .map(c => `  - ${c.name} (${c.type})`)
    .join('\n');

  return `You are a data command assistant for a spreadsheet/data viewer application running DuckDB. Help users work with their data efficiently.

## Current Data Context
**Table Name:** "${tableName}"
**Columns:**
${schemaStr}

**Total Rows:** ${context.totalRows.toLocaleString()}
${context.currentSort ? `**Current Sort:** ${context.currentSort.column} ${context.currentSort.direction}` : ''}
${context.currentFilters ? `**Active Filters:** ${context.currentFilters}` : ''}

## Two Types of Responses

### 1. Simple Commands (for basic operations)
For simple sorting, filtering, pagination - use these commands (EXACT syntax):

**View Controls:**
- \`show first [N] rows\` or \`limit [N]\` - Limit displayed rows
- \`go to page [N]\` or \`page [N]\` - Navigate to specific page
- \`reset view\` or \`clear filters\` - Reset all filters

**Sorting & Filtering:**
- \`sort by [column] asc\` or \`sort by [column] desc\` - Sort by column
- \`filter [column] [operator] [value]\` - Filter rows (=, >, <, >=, <=, !=, contains)
- \`search [term]\` - Search across all text columns

**Data Modification:**
- \`fill empty [column] with "[value]"\` - Fill null/empty values
- \`update [column] to "[value]" where [condition]\` - Conditional update
- \`delete where [column] = "[value]"\` - Delete matching rows

**Export:**
- \`export as csv\` or \`export as json\`

### 2. SQL Queries (for analytical/complex operations)
For analytical questions, aggregations, correlations, statistics, grouping, joins, or any complex query - generate DuckDB SQL.

Use SQL for:
- Correlation analysis (use CORR() function)
- Statistical summaries (AVG, STDDEV, PERCENTILE_CONT, etc.)
- Grouping and aggregations (GROUP BY with COUNT, SUM, AVG)
- Finding patterns or anomalies
- Complex filtering with multiple conditions
- Calculations between columns
- Data quality checks (finding nulls, duplicates, outliers)

## Response Format

**For simple commands**, wrap in a plain code block:
\`\`\`
sort by price desc
\`\`\`

**For SQL queries**, wrap in a \`\`\`sql code block:
\`\`\`sql
SELECT column, COUNT(*) as count
FROM "${tableName}"
GROUP BY column
ORDER BY count DESC
LIMIT 10
\`\`\`

## Examples

User: "sort by price highest first"
→ \`\`\`
sort by price desc
\`\`\`

User: "find correlation between age and income"
→ \`\`\`sql
SELECT
  ROUND(CORR("age", "income"), 3) as correlation,
  COUNT(*) as sample_size,
  ROUND(AVG("age"), 1) as avg_age,
  ROUND(AVG("income"), 1) as avg_income
FROM "${tableName}"
WHERE "age" IS NOT NULL AND "income" IS NOT NULL
\`\`\`

User: "show distribution of categories"
→ \`\`\`sql
SELECT "category", COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 1) as percentage
FROM "${tableName}"
GROUP BY "category"
ORDER BY count DESC
\`\`\`

User: "find outliers in price"
→ \`\`\`sql
WITH stats AS (
  SELECT AVG("price") as mean, STDDEV("price") as std
  FROM "${tableName}"
)
SELECT * FROM "${tableName}", stats
WHERE ABS("price" - mean) > 2 * std
ORDER BY "price" DESC
LIMIT 20
\`\`\`

User: "show rows with zero or null values"
→ \`\`\`sql
SELECT * FROM "${tableName}"
WHERE "column1" IS NULL OR "column1" = 0
  OR "column2" IS NULL OR "column2" = 0
LIMIT 100
\`\`\`

User: "change all values of status that are 0 to 1 and also change flag from 0 to 1"
→ \`\`\`sql
UPDATE "${tableName}" SET
  "status" = CASE WHEN "status" = 0 THEN 1 ELSE "status" END,
  "flag" = CASE WHEN "flag" = 0 THEN 1 ELSE "flag" END
WHERE "status" = 0 OR "flag" = 0
\`\`\`

User: "set active to true and verified to 1 for all rows where active is false"
→ \`\`\`sql
UPDATE "${tableName}" SET
  "active" = true,
  "verified" = 1
WHERE "active" = false
\`\`\`

## Important Notes
- Always quote column names with double quotes: "column_name"
- Always quote the table name: "${tableName}"
- Keep SQL concise but correct
- For correlation, use DuckDB's CORR() function
- **CRITICAL: When user asks to update MULTIPLE columns, ALWAYS combine them into a SINGLE SQL UPDATE statement using multiple SET clauses. NEVER output multiple separate code blocks.**
- For conditional updates on different rows, use CASE WHEN expressions
- Be brief in explanations - users want results`;
}

/**
 * Stream a response from the AI command assistant
 * Uses Opus 4.5 for most accurate SQL generation
 */
export async function streamCommandAssistant(
  apiKey: string,
  userMessage: string,
  context: CommandContext,
  onChunk: (text: string) => void,
  onComplete: (fullText: string) => void,
  onError: (error: Error) => void
): Promise<void> {
  const tableName = context.tableName || 'data';
  const systemPrompt = buildCommandSystemPrompt(context, tableName);

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: AI_MODELS.OPUS,  // Use Opus 4.5 for best SQL generation
        max_tokens: 1024,
        stream: true,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error: ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let fullText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              const text = parsed.delta.text;
              fullText += text;
              onChunk(text);
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }

    onComplete(fullText);
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Generate smart suggestions based on schema
 * Returns an array of natural language suggestions
 */
export async function generateSmartSuggestions(
  apiKey: string,
  context: CommandContext
): Promise<string[]> {
  const schemaStr = context.schema
    .filter(c => c.name !== '_rowid')
    .map(c => `${c.name} (${c.type})`)
    .join(', ');

  const prompt = `Given this data schema: ${schemaStr}
With ${context.totalRows.toLocaleString()} total rows.

Generate exactly 4 short, natural language questions/commands a user might want to try. Include a mix of:
- Simple operations (sort, filter, search)
- Analytical queries (correlations, distributions, aggregations, statistics)
- Finding patterns, outliers, or data quality issues

Return ONLY a JSON array of 4 strings, no explanation. Example:
["Show distribution by category", "Find correlation between price and rating", "Sort by date", "Show rows with missing values"]`;

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: AI_MODELS.HAIKU,
        max_tokens: 256,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const text = data.content[0]?.text || "";

    // Parse JSON array from response
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      const suggestions = JSON.parse(match[0]);
      if (Array.isArray(suggestions)) {
        return suggestions.slice(0, 4);
      }
    }
  } catch {
    // Silently fail - suggestions are optional
  }

  return [];
}

/**
 * Non-streaming version for quick commands
 * Uses Opus 4.5 for most accurate SQL generation
 */
export async function askCommandAssistant(
  apiKey: string,
  userMessage: string,
  context: CommandContext
): Promise<CommandAssistantResponse> {
  const tableName = context.tableName || 'data';
  const systemPrompt = buildCommandSystemPrompt(context, tableName);

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: AI_MODELS.OPUS,  // Use Opus 4.5 for best SQL generation
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error: ${error}`);
  }

  const data = await response.json();
  const text = data.content[0]?.text || "";

  // Extract command from code block if present
  const commandMatch = text.match(/```\n?([\s\S]*?)```/);
  let suggestedCommand: CommandAssistantResponse['suggestedCommand'];

  if (commandMatch) {
    const command = commandMatch[1].trim();
    // Determine command type from the command text
    let type = 'custom';
    if (command.startsWith('sort')) type = 'sort';
    else if (command.startsWith('filter')) type = 'filter';
    else if (command.startsWith('search')) type = 'search';
    else if (command.startsWith('fill')) type = 'fill';
    else if (command.startsWith('update') || command.startsWith('change')) type = 'update';
    else if (command.startsWith('delete') || command.startsWith('remove')) type = 'delete';
    else if (command.startsWith('export')) type = 'export';
    else if (command.includes('theme')) type = 'theme';
    else if (command.startsWith('show') || command.startsWith('limit')) type = 'limit';
    else if (command.startsWith('page') || command.startsWith('go to page')) type = 'page';
    else if (command.startsWith('reset') || command.startsWith('clear') || command === 'show all') type = 'reset';

    suggestedCommand = {
      type,
      command,
      explanation: text.replace(/```[\s\S]*?```/g, '').trim(),
    };
  }

  return { text, suggestedCommand };
}

// ============ GLOBAL SEARCH ASSISTANT ============

export interface FileContext {
  id: string;
  name: string;
  type: string;
  rowCount?: number;
  columnCount?: number;
  columns?: string[];
}

export interface GlobalSearchContext {
  files: FileContext[];
  folders: { name: string; fileCount: number }[];
}

function buildGlobalSystemPrompt(context: GlobalSearchContext): string {
  const filesStr = context.files.length > 0
    ? context.files.map(f => {
        let desc = `- **${f.name}** (${f.type})`;
        if (f.rowCount) desc += ` - ${f.rowCount.toLocaleString()} rows`;
        if (f.columnCount) desc += `, ${f.columnCount} columns`;
        if (f.columns && f.columns.length > 0) {
          desc += `\n  Columns: ${f.columns.slice(0, 10).join(', ')}${f.columns.length > 10 ? '...' : ''}`;
        }
        return desc;
      }).join('\n')
    : 'No files loaded yet.';

  const foldersStr = context.folders.length > 0
    ? context.folders.map(f => `- **${f.name}** (${f.fileCount} files)`).join('\n')
    : '';

  return `You are an AI assistant for OpenSheet, a data exploration application. Help users understand their workspace and files.

## Current Workspace

### Files
${filesStr}

${foldersStr ? `### Folders\n${foldersStr}` : ''}

## Your Role
- Help users understand what files they have and what data is in them
- Suggest which file to explore based on their questions
- Explain what operations they can do (sort, filter, search, export)
- If they ask about specific data, suggest opening the relevant file
- Keep responses concise and helpful

## Available Actions
Users can:
- Open any file by clicking or using keyboard (Enter)
- Use ⌘K to search files and commands
- Use / or ⌘K in focused view for AI-powered data commands
- Drag files onto each other to create folders
- Export data as CSV, JSON, or Parquet`;
}

/**
 * Ask AI about files in the global search context (non-streaming)
 * Returns a helpful response about available files and their data
 */
export async function askGlobalAssistant(
  apiKey: string,
  userMessage: string,
  context: GlobalSearchContext
): Promise<string> {
  const systemPrompt = buildGlobalSystemPrompt(context);

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: AI_MODELS.HAIKU,
      max_tokens: 512,
      messages: [{ role: "user", content: userMessage }],
      system: systemPrompt,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error: ${error}`);
  }

  const data = await response.json();
  return data.content[0]?.text || "I couldn't generate a response.";
}

/**
 * Stream AI response for global search (matches FloatingAICommand experience)
 */
export async function streamGlobalAssistant(
  apiKey: string,
  userMessage: string,
  context: GlobalSearchContext,
  onChunk: (text: string) => void,
  onComplete: (fullText: string) => void,
  onError: (error: Error) => void
): Promise<void> {
  const systemPrompt = buildGlobalSystemPrompt(context);

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: AI_MODELS.HAIKU,
        max_tokens: 512,
        stream: true,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error: ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let fullText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              const text = parsed.delta.text;
              fullText += text;
              onChunk(text);
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }

    onComplete(fullText);
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)));
  }
}
