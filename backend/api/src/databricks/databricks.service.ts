import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { DBSQLClient } from '@databricks/sql';
import { DatabricksConnectionDto } from './dto/connection.dto';
import { DatabricksQueryDto } from './dto/query.dto';
import { DatabricksExploreFiltersDto } from './dto/explore.dto';

@Injectable()
export class DatabricksService {
  async createClient(
    conn: DatabricksConnectionDto,
  ): Promise<{ client: any; session: any }> {
    console.log('[Databricks] Connecting to:', conn.host, conn.httpPath);
    const client = new DBSQLClient();

    try {
      const connectAmountMs = conn.timeout || 30000;

      const connectWork = async () => {
        const connection = await client.connect({
          token: conn.token,
          host: conn.host,
          path: conn.httpPath,
        });
        console.log('[Databricks] Client connected');

        const session = await connection.openSession();
        console.log('[Databricks] Session opened');
        return { client: connection, session };
      };

      const timeoutWork = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Connection timed out after ${connectAmountMs}ms`)), connectAmountMs);
      });

      return await Promise.race([connectWork(), timeoutWork]);
    } catch (error: any) {
      console.error('[Databricks] Connection failed:', error);
      // Try to close client if it was opened but failed later or timed out
      try { await client.close(); } catch (e) { /* ignore */ }

      throw new InternalServerErrorException(`Failed to connect to Databricks: ${error.message || error}`);
    }
  }

  private matchesFilter(
    name: string,
    list?: string[],
    search?: string,
  ): boolean {
    if (list && list.length > 0) {
      if (!list.some((v) => v.toLowerCase() === name.toLowerCase())) {
        return false;
      }
    }

    if (search && !name.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }

    return true;
  }

  async listCatalogsSchemasTables(
    conn: DatabricksConnectionDto,
    filters?: DatabricksExploreFiltersDto,
  ): Promise<any> {
    console.log('[Databricks] Starting exploration...');
    const { client, session } = await this.createClient(conn);

    const effectiveFilters: DatabricksExploreFiltersDto = {
      includeViews: true,
      includeSystemSchemas: false,
      maxSchemasPerCatalog: 100,
      maxTablesPerSchema: 500,
      ...filters,
    };

    // Helper: Batching execution to limit concurrency
    const runInBatches = async <T>(tasks: (() => Promise<T>)[], batchSize: number): Promise<T[]> => {
      const results: T[] = [];
      for (let i = 0; i < tasks.length; i += batchSize) {
        const batch = tasks.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(task => task()));
        results.push(...batchResults);
      }
      return results;
    };

    try {
      // List catalogs
      console.log('[Databricks] Fetching catalogs...');
      const catalogsOp = await session.executeStatement(
        'SHOW CATALOGS',
        { runAsync: true }
      );
      const catalogs = await catalogsOp.fetchAll();
      await catalogsOp.close();
      console.log(`[Databricks] Found ${catalogs.length} catalogs`);

      const result: any[] = [];

      for (const row of catalogs as any[]) {
        const catalog = row[Object.keys(row)[0]] as string;

        if (!this.matchesFilter(catalog, effectiveFilters.catalogs, effectiveFilters.search)) {
          continue;
        }

        console.log(`[Databricks] Processing catalog: ${catalog}`);

        // List schemas
        const schemasOp = await session.executeStatement(
          `SHOW SCHEMAS IN \`${catalog}\``,
          { runAsync: true }
        );
        const schemas = await schemasOp.fetchAll();
        await schemasOp.close();

        let schemaCount = 0;
        const schemaTasks: (() => Promise<any>)[] = [];

        for (const schemaRow of schemas as any[]) {
          const schema = schemaRow[Object.keys(schemaRow)[0]] as string;

          if (effectiveFilters.includeSystemSchemas === false && ['information_schema', 'sys', 'pg_catalog'].includes(schema)) {
            continue;
          }
          if (!this.matchesFilter(schema, effectiveFilters.schemas, effectiveFilters.search)) {
            continue;
          }

          schemaCount++;
          if (effectiveFilters.maxSchemasPerCatalog && schemaCount > effectiveFilters.maxSchemasPerCatalog) {
            break;
          }

          // Define the task to fetch tables for this schema
          schemaTasks.push(async () => {
            try {
              const showTablesSql = `SHOW TABLES IN \`${catalog}\`.\`${schema}\``;

              const tablesOp = await session.executeStatement(
                showTablesSql,
                { runAsync: true }
              );
              const tablesRaw = await tablesOp.fetchAll();
              await tablesOp.close();

              const tables: any[] = [];
              let tableCount = 0;

              for (const tableRow of tablesRaw as any[]) {
                const tableNameKey = Object.keys(tableRow).find((k) => ['tableName', 'table_name', 'name'].includes(k));
                const kindKey = Object.keys(tableRow).find((k) => ['kind', 'tableType', 'table_type'].includes(k));
                const tableName = tableNameKey ? (tableRow as any)[tableNameKey] : undefined;
                const kind = kindKey ? (tableRow as any)[kindKey] : undefined;

                if (!tableName) continue;
                if (effectiveFilters.includeViews === false && kind && String(kind).toLowerCase().includes('view')) continue;
                if (!this.matchesFilter(tableName, effectiveFilters.tables, effectiveFilters.search)) continue;

                tableCount++;
                if (effectiveFilters.maxTablesPerSchema && tableCount > effectiveFilters.maxTablesPerSchema) break;

                tables.push(tableRow);
              }

              if (tables.length > 0) {
                return { catalog, schema, tables };
              }
              return null;
            } catch (err) {
              console.warn(`[Databricks] Failed to fetch tables for ${catalog}.${schema}:`, err);
              return null;
            }
          });
        }

        // Execute schema tasks in batches of 5
        console.log(`[Databricks] Fetching tables for ${schemaTasks.length} schemas in ${catalog} (concurrently)...`);
        const schemaResults = await runInBatches(schemaTasks, 5);

        // Add successful results
        schemaResults.forEach(res => {
          if (res) result.push(res);
        });
      }

      await session.close();
      await client.close();
      console.log('[Databricks] Exploration finished successfully');

      return result;
    } catch (error: any) {
      console.error('[Databricks] Exploration failed:', error);
      await session.close().catch(() => undefined);
      await client.close().catch(() => undefined);
      throw new InternalServerErrorException(
        `Failed to list catalogs/schemas/tables: ${error.message || error}`,
      );
    }
  }

  async executeQuery(
    conn: DatabricksConnectionDto,
    query: DatabricksQueryDto,
  ): Promise<{ rows: any[]; columns: any[] }> {
    const { client, session } = await this.createClient(conn);

    try {
      // Don't append limit to schema-related commands that don't support it
      const isSchemaQuery = /^\s*(DESCRIBE|SHOW|USE)\s+/i.test(query.sql);
      const sqlWithLimit = (query.limit && !isSchemaQuery)
        ? `${query.sql}\nLIMIT ${query.limit} OFFSET ${query.offset || 0}`
        : query.sql;

      const op = await session.executeStatement(
        sqlWithLimit,
        { runAsync: true }
      );

      const rows = await op.fetchAll();
      const columns = op.getSchema ? op.getSchema() : [];
      await op.close();
      await session.close();
      await client.close();

      return { rows, columns };
    } catch (error: any) {
      await session.close().catch(() => undefined);
      await client.close().catch(() => undefined);
      throw new InternalServerErrorException(`Failed to execute Databricks query: ${error.message || error}`);
    }
  }
}
