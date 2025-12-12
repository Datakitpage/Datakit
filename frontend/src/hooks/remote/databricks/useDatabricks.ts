import { useState, useCallback } from 'react';
import { databricksService } from '@/lib/api/databricksService';
import { DatabricksConnection, DatabricksTableGroup, DatabricksQueryResult } from '@/types/databricks';

export interface UseDatabricksResult {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connection: DatabricksConnection | null;
  tables: DatabricksTableGroup[];
  connect: (connection: DatabricksConnection) => Promise<void>;
  refresh: () => Promise<void>;
  executeQuery: (sql: string, limit?: number) => Promise<DatabricksQueryResult>;
  clearError: () => void;
}

const STORAGE_KEY = 'datakit-databricks-connection';

export const useDatabricks = (): UseDatabricksResult => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<DatabricksConnection | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? (JSON.parse(stored) as DatabricksConnection) : null;
    } catch {
      return null;
    }
  });
  const [tables, setTables] = useState<DatabricksTableGroup[]>([]);

  const persistConnection = useCallback((conn: DatabricksConnection | null) => {
    try {
      if (conn) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(conn));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (err) {
      console.warn('[useDatabricks] Failed to persist connection:', err);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const connect = useCallback(
    async (conn: DatabricksConnection): Promise<void> => {
      setIsConnecting(true);
      setError(null);
      try {
        const response = await databricksService.explore(conn);
        const result = (response as any).data as DatabricksTableGroup[];
        setConnection(conn);
        persistConnection(conn);
        setTables(result);
        setIsConnected(true);
      } catch (err: any) {
        console.error('[useDatabricks] Failed to connect:', err);
        setError(err?.message || 'Failed to connect to Databricks');
        setIsConnected(false);
      } finally {
        setIsConnecting(false);
      }
    },
    [persistConnection],
  );

  const refresh = useCallback(async () => {
    if (!connection) return;
    try {
      const response = await databricksService.explore(connection);
      const result = (response as any).data as DatabricksTableGroup[];
      setTables(result);
      setIsConnected(true);
    } catch (err: any) {
      console.error('[useDatabricks] Failed to refresh:', err);
      setError(err?.message || 'Failed to refresh Databricks metadata');
    }
  }, [connection]);

  const executeQuery = useCallback(
    async (sql: string, limit = 100): Promise<DatabricksQueryResult> => {
      if (!connection) {
        throw new Error('Not connected to Databricks');
      }
      try {
        return (await databricksService.executeQuery(connection, sql, limit)) as DatabricksQueryResult;
      } catch (err: any) {
        console.error('[useDatabricks] Query failed:', err);
        setError(err?.message || 'Databricks query failed');
        throw err;
      }
    },
    [connection],
  );

  return {
    isConnected,
    isConnecting,
    error,
    connection,
    tables,
    connect,
    refresh,
    executeQuery,
    clearError,
  };
};

export default useDatabricks;

