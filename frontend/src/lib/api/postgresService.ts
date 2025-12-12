import apiClient from "./apiClient";
import {
  PostgreSQLConnection,
  CreateConnectionRequest,
  UpdateConnectionRequest,
  TestConnectionRequest,
  ConnectionTestResult,
  PostgreSQLSchema,
  PostgreSQLTable,
  PostgreSQLTableInfo,
  QueryRequest,
  QueryResult,
  TablePreviewRequest,
  TablePreviewResult,
} from "@/types/postgres";

// Backend response wrapper interface
interface BackendResponse<T> {
  statusCode: number;
  message: string;
  data: T;
}

class PostgreSQLService {
  private readonly baseUrl = "/postgres-proxy";

  // Connection Management
  async testConnection(config: TestConnectionRequest): Promise<ConnectionTestResult> {
    const response = await apiClient.post<BackendResponse<ConnectionTestResult>>(`${this.baseUrl}/connections/test`, config);
    return response.data;
  }

  async createConnection(config: CreateConnectionRequest): Promise<PostgreSQLConnection> {
    const response = await apiClient.post<BackendResponse<PostgreSQLConnection>>(`${this.baseUrl}/connections`, config);
    return response.data;
  }

  async getConnections(): Promise<PostgreSQLConnection[]> {
    const response = await apiClient.get<BackendResponse<PostgreSQLConnection[]>>(`${this.baseUrl}/connections`);
    return response.data;
  }

  async getConnection(id: string): Promise<PostgreSQLConnection> {
    const response = await apiClient.get<BackendResponse<PostgreSQLConnection>>(`${this.baseUrl}/connections/${id}`);
    return response.data;
  }

  async updateConnection(config: UpdateConnectionRequest): Promise<PostgreSQLConnection> {
    const response = await apiClient.put<BackendResponse<PostgreSQLConnection>>(`${this.baseUrl}/connections/${config.id}`, config);
    return response.data;
  }

  async deleteConnection(id: string): Promise<{ message: string }> {
    const response = await apiClient.delete<BackendResponse<{ message: string }>>(`${this.baseUrl}/connections/${id}`);
    return { message: response.message };
  }

  // Schema Discovery
  async getSchemas(connectionId: string): Promise<PostgreSQLSchema[]> {
    const response = await apiClient.get<BackendResponse<any[]>>(`${this.baseUrl}/connections/${connectionId}/schemas`);

    // Transform API response to match frontend types
    return response.data.map((schema: any) => ({
      schemaName: schema.name,
      tableCount: schema.tableCount || 0,
      viewCount: schema.viewCount || 0,
      isSystemSchema: schema.isSystem || false,
    }));
  }

  async getTables(connectionId: string, schemaName: string): Promise<PostgreSQLTable[]> {
    const response = await apiClient.get<BackendResponse<any[]>>(
      `${this.baseUrl}/connections/${connectionId}/schemas/${encodeURIComponent(schemaName)}/tables`
    );

    return this.transformTablesResponse(response.data);
  }

  async getTablesForDefaultSchema(connectionId: string): Promise<PostgreSQLTable[]> {
    const connection = await this.getConnection(connectionId);
    const defaultSchema = connection.schema || 'public';
    return this.getTables(connectionId, defaultSchema);
  }

  private transformTablesResponse(tables: any[]): PostgreSQLTable[] {
    // Transform API response to match frontend types
    return tables.map((table: any) => ({
      tableName: table.name,
      schemaName: table.schema,
      tableType: table.type,
      rowCount: table.rowCount,
      size: table.sizeBytes ? this.formatBytes(table.sizeBytes) : undefined,
      comment: table.comment,
      lastModified: undefined, // API doesn't provide this yet
      columns: table.columns?.map((col: any) => ({
        columnName: col.name,
        dataType: col.type,
        isNullable: col.nullable,
        defaultValue: col.defaultValue,
        isPrimaryKey: col.isPrimaryKey || false,
        isForeignKey: col.isForeignKey || false,
        characterMaximumLength: col.characterMaximumLength,
        numericPrecision: col.numericPrecision,
        numericScale: col.numericScale,
        comment: col.comment,
      })) || [],
    }));
  }

  async getTableInfo(
    connectionId: string,
    schemaName: string,
    tableName: string
  ): Promise<PostgreSQLTableInfo> {
    const response = await apiClient.get<BackendResponse<PostgreSQLTableInfo>>(
      `${this.baseUrl}/connections/${connectionId}/schemas/${encodeURIComponent(
        schemaName
      )}/tables/${encodeURIComponent(tableName)}`
    );
    return response.data;
  }

  async previewTableData(
    connectionId: string,
    schemaName: string,
    tableName: string,
    options: TablePreviewRequest = {}
  ): Promise<TablePreviewResult> {
    const params = new URLSearchParams();

    if (options.limit) params.append('limit', options.limit.toString());
    if (options.offset) params.append('offset', options.offset.toString());
    if (options.orderBy) {
      params.append('orderBy', options.orderBy.column);
      params.append('orderDirection', options.orderBy.direction);
    }

    // Add filters as JSON if present
    if (options.filters && options.filters.length > 0) {
      params.append('filters', JSON.stringify(options.filters));
    }

    const queryString = params.toString();
    const url = `${this.baseUrl}/connections/${connectionId}/schemas/${encodeURIComponent(
      schemaName
    )}/tables/${encodeURIComponent(tableName)}/preview${queryString ? `?${queryString}` : ''}`;

    const response = await apiClient.post<BackendResponse<TablePreviewResult>>(url, options);
    return response.data;
  }

  async fetchTableDataForImport(
    connectionId: string,
    schemaName: string,
    tableName: string,
    options: { sampleOnly?: boolean } = {}
  ): Promise<{ columns: { name: string; type: string }[]; rows: any[][] }> {
    // API limits preview to 100 rows, so we use that as max for now
    // In the future, a proper export endpoint should be used for full imports
    const limit = options.sampleOnly ? 50 : 100;

    const result = await this.previewTableData(
      connectionId,
      schemaName,
      tableName,
      { limit }
    );

    return {
      // Map QueryColumn to simple format expected by DuckDBStore
      columns: result.columns.map((c: any) => ({
        name: c.name,
        type: c.dataTypeID?.toString() || 'text' // Fallback to text if type missing
      })),
      rows: result.rows
    };
  }

  // Query Execution
  async executeQuery(connectionId: string, query: QueryRequest): Promise<QueryResult> {
    const response = await apiClient.post<BackendResponse<QueryResult>>(`${this.baseUrl}/connections/${connectionId}/query`, query);
    return response.data;
  }

  // Health Check
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const response = await apiClient.get<BackendResponse<{ status: string; timestamp: string }>>(`${this.baseUrl}/health`);
    return { status: 'healthy', timestamp: response.data.timestamp || new Date().toISOString() };
  }

  // Helper methods for common operations

  /**
   * Get all tables across all schemas for a connection
   */
  async getAllTables(connectionId: string): Promise<PostgreSQLTable[]> {
    const schemas = await this.getSchemas(connectionId);
    const allTables: PostgreSQLTable[] = [];

    // Fetch tables for each schema concurrently
    const tablePromises = schemas.map(schema =>
      this.getTables(connectionId, schema.schemaName)
        .catch(error => {
          console.warn(`Failed to load tables for schema ${schema.schemaName}:`, error);
          return []; // Return empty array on error
        })
    );

    const schemaTablesArrays = await Promise.allSettled(tablePromises);

    schemaTablesArrays.forEach(result => {
      if (result.status === 'fulfilled') {
        allTables.push(...result.value);
      }
    });

    return allTables;
  }

  /**
   * Search tables by name across all schemas
   */
  async searchTables(connectionId: string, searchTerm: string): Promise<PostgreSQLTable[]> {
    const allTables = await this.getAllTables(connectionId);
    const lowerSearchTerm = searchTerm.toLowerCase();

    return allTables.filter(table =>
      table.tableName.toLowerCase().includes(lowerSearchTerm) ||
      table.schemaName.toLowerCase().includes(lowerSearchTerm)
    );
  }

  /**
   * Get table count and size statistics for a connection
   */
  async getConnectionStats(connectionId: string): Promise<{
    totalTables: number;
    totalViews: number;
    schemaCount: number;
    largestTable?: { name: string; size: string };
  }> {
    const schemas = await this.getSchemas(connectionId);
    const allTables = await this.getAllTables(connectionId);

    const totalTables = allTables.filter(t => t.tableType === 'table').length;
    const totalViews = allTables.filter(t => t.tableType === 'view' || t.tableType === 'materialized_view').length;

    // Find largest table by attempting to parse size
    let largestTable: { name: string; size: string } | undefined;
    for (const table of allTables) {
      if (table.size && (!largestTable || this.compareSize(table.size, largestTable.size) > 0)) {
        largestTable = {
          name: `${table.schemaName}.${table.tableName}`,
          size: table.size
        };
      }
    }

    return {
      totalTables,
      totalViews,
      schemaCount: schemas.length,
      largestTable,
    };
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 bytes';

    const k = 1024;
    const sizes = ['bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  /**
   * Helper to compare table sizes (rough approximation)
   */
  private compareSize(size1: string, size2: string): number {
    const parseSize = (size: string): number => {
      const match = size.match(/^([\d.]+)\s*(bytes?|KB|MB|GB|TB)?$/i);
      if (!match) return 0;

      const value = parseFloat(match[1]);
      const unit = (match[2] || 'bytes').toLowerCase();

      const multipliers: Record<string, number> = {
        'bytes': 1,
        'byte': 1,
        'kb': 1024,
        'mb': 1024 * 1024,
        'gb': 1024 * 1024 * 1024,
        'tb': 1024 * 1024 * 1024 * 1024,
      };

      return value * (multipliers[unit] || 1);
    };

    return parseSize(size1) - parseSize(size2);
  }

  /**
   * Execute a simple SELECT query with error handling
   */
  async selectFromTable(
    connectionId: string,
    schemaName: string,
    tableName: string,
    limit = 100,
    columns = ['*']
  ): Promise<QueryResult> {
    const columnList = columns.join(', ');
    const sql = `SELECT ${columnList} FROM "${schemaName}"."${tableName}" LIMIT ${limit}`;

    return this.executeQuery(connectionId, {
      sql,
      limit,
      timeout: 30000
    });
  }

  /**
   * Test if connection is still active
   */
  async testConnectionHealth(connectionId: string): Promise<boolean> {
    try {
      const result = await this.executeQuery(connectionId, {
        sql: 'SELECT 1 as health_check',
        timeout: 5000
      });
      return result.rowCount === 1;
    } catch (error) {
      return false;
    }
  }
}

export const postgreSQLService = new PostgreSQLService();
export default postgreSQLService;