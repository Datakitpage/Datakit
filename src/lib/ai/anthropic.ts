import { TableSchema } from "@/store/dataStore";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface DashboardSuggestion {
  widgets: Array<{
    type: "metric" | "chart" | "table";
    title: string;
    sql: string;
    config: Record<string, any>;
  }>;
  insights: string[];
}

export interface AIResponse {
  text: string;
  sql?: string;
  dashboardSuggestion?: DashboardSuggestion;
}

function buildSystemPrompt(schema: TableSchema[], tableName: string, sampleData?: any[]): string {
  const schemaStr = schema.map((col) => col.name + " (" + col.type + ")").join(", ");
  
  let prompt = "You are an AI assistant for Board, a data dashboard application. ";
  prompt += "You help users understand their data and create visualizations.\n\n";
  prompt += "Current data table: " + tableName + "\n";
  prompt += "Schema: " + schemaStr + "\n\n";
  
  if (sampleData && sampleData.length > 0) {
    prompt += "Sample data (first 3 rows):\n";
    prompt += JSON.stringify(sampleData.slice(0, 3), null, 2) + "\n\n";
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

function buildAutoDashboardPrompt(schema: TableSchema[], tableName: string, sampleData: any[]): string {
  const schemaStr = schema.map((col) => col.name + " (" + col.type + ")").join(", ");
  
  let prompt = "Analyze this data and suggest a dashboard layout.\n\n";
  prompt += "Table: " + tableName + "\n";
  prompt += "Schema: " + schemaStr + "\n\n";
  prompt += "Sample data:\n" + JSON.stringify(sampleData.slice(0, 5), null, 2) + "\n\n";
  
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
  sampleData?: any[]
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
  sampleData: any[]
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
