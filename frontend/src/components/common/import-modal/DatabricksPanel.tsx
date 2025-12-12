import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { useDatabricks } from '@/hooks/remote/databricks/useDatabricks';
import { databricksService } from '@/lib/api/databricksService';
import { useDuckDBStore } from '@/store/duckDBStore';
import { useFolderStore } from '@/store/folderStore';

interface DatabricksPanelProps {
  onImport: () => void;
}

const DatabricksPanel: React.FC<DatabricksPanelProps> = ({ onImport }) => {
  const { t } = useTranslation();
  const { isConnected, isConnecting, error, connect, tables, clearError, connection } = useDatabricks();

  useEffect(() => {
    console.log('[DatabricksPanel] Mounted. Connection:', !!connection, 'Tables count:', tables.length);
  }, [connection, tables]);

  const [token, setToken] = useState('');
  const [host, setHost] = useState('');
  const [httpPath, setHttpPath] = useState('');

  // Pre-fill form if connection exists (restored from localStorage)
  useEffect(() => {
    if (connection) {
      setToken(connection.token);
      setHost(connection.host);
      setHttpPath(connection.httpPath);
    }
  }, [connection]);


  const { addVirtualDatabricksTable } = useDuckDBStore();
  const { addFile, remoteFolderId } = useFolderStore();
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    await connect({ token, host, httpPath });
  };

  const handleToggleTable = (catalog: string, schema: string, tableName: string) => {
    const key = `${catalog}.${schema}.${tableName}`;
    const newSelected = new Set(selectedTables);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    console.log(`[DatabricksPanel] Toggled table ${key}. New count: ${newSelected.size}`);
    setSelectedTables(newSelected);
  };

  const handleImportSelected = async () => {
    console.log('[DatabricksPanel] Import button clicked. State:', {
      tokenLength: token?.length,
      host,
      httpPath,
      selectedCount: selectedTables.size
    });

    if (!token || !host || !httpPath) {
      console.error("Cannot import: Connection details missing");
      return;
    }

    const tablesToImport: Array<{ group: any; tableName: string }> = [];

    // Collect tables to import
    console.warn('[DatabricksPanel] Collecting tables to import from selection:', Array.from(selectedTables));
    tables.forEach((group) => {
      group.tables.forEach((t) => {
        const nameKey = Object.keys(t).find((k) =>
          ['tableName', 'table_name', 'name'].includes(k),
        );
        const tableName = nameKey ? (t as any)[nameKey] : undefined;
        if (!tableName) return;

        const key = `${group.catalog}.${group.schema}.${tableName}`;
        // console.warn(`[DatabricksPanel] Checking key: ${key}, Selected: ${selectedTables.has(key)}`);

        if (selectedTables.has(key)) {
          tablesToImport.push({ group, tableName });
        }
      });
    });
    console.warn(`[DatabricksPanel] Identified ${tablesToImport.length} tables to import`);

    // Import sequentially to avoid overwhelming connection
    console.log('[DatabricksPanel] Starting import for', tablesToImport.length, 'tables');

    for (const { group, tableName } of tablesToImport) {
      try {
        console.log(`[DatabricksPanel] Fetching schema for ${tableName}...`);

        // Fetch columns using DESCRIBE for reliability
        const response = await databricksService.executeQuery({ token, host, httpPath } as any, `DESCRIBE ${group.catalog}.${group.schema}.${tableName}`);

        console.log(`[DatabricksPanel] Schema fetch response for ${tableName}:`, response);

        const resultData = (response as any).data;
        // DESCRIBE returns schema info in rows: col_name, data_type, comment
        const rows = resultData?.rows || [];

        console.log(`[DatabricksPanel] DESCRIBE rows for ${tableName}:`, rows);

        // Filter out partition info (usually starts with # or empty data_type)
        const mappedColumns = rows
          .filter((row: any) => row.col_name && row.data_type && !row.col_name.startsWith('#'))
          .map((row: any) => ({
            name: row.col_name,
            type: row.data_type || "UNKNOWN"
          }));

        if (mappedColumns.length === 0) {
          console.warn(`[DatabricksPanel] No columns found via DESCRIBE for ${tableName}, falling back to metadata columns if available`);
          // Fallback to metadata columns if DESCRIBE returned nothing valid (unlikely for valid table)
          const metaCols = Array.isArray(resultData?.columns) ? resultData.columns : [];
          if (metaCols.length > 0) {
            mappedColumns.push(...metaCols.map((col: any) => ({
              name: col.name,
              type: col.typeDesc || col.type || "UNKNOWN"
            })));
          }
        }

        console.log(`[DatabricksPanel] Mapped ${mappedColumns.length} columns for ${tableName}`);

        addVirtualDatabricksTable({
          connection: connection!,
          catalog: group.catalog,
          schema: group.schema,
          tableName: tableName,
          columns: mappedColumns,
          isImported: true,
        });

        console.log(`[DatabricksPanel] Added virtual table ${tableName}`);

        // Register with Folder Store (Sidebar UI)
        const file = new File([], tableName, { lastModified: Date.now() });
        addFile(
          file,
          {
            isRemote: true,
            remoteUrl: `databricks://${host}`,
            fileType: 'duckdb',
            isLoaded: true,
            tableName: tableName,
            size: 0,
            columnCount: mappedColumns.length
          },
          remoteFolderId || undefined
        );
        console.log(`[DatabricksPanel] Added file node for ${tableName}`);

      } catch (error) {
        console.error(`Failed to import table ${tableName}:`, error);
      }
    }

    onImport();
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-white/10">
        <h2 className="text-lg font-medium text-white">
          {t('import.databricks.title', { defaultValue: 'Databricks SQL Warehouse' })}
        </h2>
        <p className="text-white/70 text-sm mt-1">
          {t('import.databricks.subtitle', {
            defaultValue: 'Connect with a personal access token and warehouse endpoint.',
          })}
        </p>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        <form className="space-y-4" onSubmit={handleConnect}>
          <div>
            <label className="block text-xs font-medium text-white/70 mb-1">
              {t('import.databricks.tokenLabel', { defaultValue: 'Personal Access Token' })}
            </label>
            <input
              type="password"
              className="w-full rounded-md bg-black/40 border border-white/20 px-3 py-2 text-sm text-white"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={t('import.databricks.tokenPlaceholder', { defaultValue: 'dapi...' }) as string}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-white/70 mb-1">
              {t('import.databricks.hostLabel', { defaultValue: 'Workspace Host' })}
            </label>
            <input
              type="text"
              className="w-full rounded-md bg-black/40 border border-white/20 px-3 py-2 text-sm text-white"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder={t('import.databricks.hostPlaceholder', {
                defaultValue: 'dbc-xxxx.cloud.databricks.com',
              }) as string}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-white/70 mb-1">
              {t('import.databricks.httpPathLabel', { defaultValue: 'SQL Warehouse HTTP Path' })}
            </label>
            <input
              type="text"
              className="w-full rounded-md bg-black/40 border border-white/20 px-3 py-2 text-sm text-white"
              value={httpPath}
              onChange={(e) => setHttpPath(e.target.value)}
              placeholder={t('import.databricks.httpPathPlaceholder', {
                defaultValue: '/sql/1.0/warehouses/xxxxxxxx',
              }) as string}
              required
            />
          </div>

          {error && (
            <div className="text-sm text-red-400">
              {error}
              <button
                type="button"
                onClick={clearError}
                className="ml-2 text-xs underline text-red-300"
              >
                {t('common.clear', { defaultValue: 'Clear' })}
              </button>
            </div>
          )}

          <Button
            type="submit"
            disabled={isConnecting}
            className="mt-2"
          >
            {isConnecting
              ? t('import.databricks.connecting', { defaultValue: 'Connecting…' })
              : isConnected
                ? t('import.databricks.refresh', { defaultValue: 'Refresh' })
                : t('import.databricks.connect', { defaultValue: 'Connect' })}
          </Button>
        </form>

        {isConnected && tables.length > 0 && (
          <div className="mt-6 flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-white">
                {t('import.databricks.availableTables', { defaultValue: 'Available Tables' })}
              </h3>
              {selectedTables.size > 0 && (
                <Button onClick={handleImportSelected} variant="default" size="sm">
                  {t('import.databricks.importSelected', { defaultValue: `Import ${selectedTables.size} Table(s)` })}
                </Button>
              )}
            </div>

            <div className="max-h-96 overflow-auto border border-white/10 rounded-md divide-y divide-white/5">
              {tables.map((group, idx) => (
                <div key={`${group.catalog}.${group.schema}.${idx}`} className="p-3 text-xs text-white/80">
                  <div className="font-semibold text-white mb-2 sticky top-0 bg-black/80 p-1">
                    {group.catalog}.{group.schema}
                  </div>
                  <div className="grid grid-cols-1 gap-1">
                    {group.tables.map((t, i) => {
                      const nameKey = Object.keys(t).find((k) =>
                        ['tableName', 'table_name', 'name'].includes(k),
                      );
                      const tableName = nameKey ? (t as any)[nameKey] : 'unknown';
                      const key = `${group.catalog}.${group.schema}.${tableName}`;
                      const isSelected = selectedTables.has(key);

                      return (
                        <div
                          key={i}
                          onClick={() => handleToggleTable(group.catalog, group.schema, tableName)}
                          className={`
                            flex items-center px-3 py-2 rounded cursor-pointer transition-colors
                            ${isSelected ? 'bg-blue-600/20 border-blue-500/30' : 'hover:bg-white/5 border-transparent'}
                            border
                          `}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => { }} // Handled by div click
                            className="mr-3 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className={`${isSelected ? 'text-blue-200' : 'text-white/70'}`}>
                            {tableName}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DatabricksPanel;

