
import { apiClient } from './apiClient';
import { DatabricksConnection } from '@/types/databricks';

export const databricksService = {
  // Execute a query against Databricks
  executeQuery: async (
    connection: DatabricksConnection,
    sql: string,
    limit?: number
  ) => {
    return apiClient.post('/databricks/query', {
      connection: {
        token: connection.token,
        host: connection.host,
        httpPath: connection.httpPath,
        timeout: connection.timeout
      },
      query: {
        sql,
        limit
      }
    });
  },

  // Explore tables (catalogs/schemas)
  explore: async (
    connection: DatabricksConnection,
    filters?: any
  ) => {
    return apiClient.post('/databricks/explore', {
      connection: {
        token: connection.token,
        host: connection.host,
        httpPath: connection.httpPath,
        timeout: connection.timeout
      },
      filters
    });
  }
};
