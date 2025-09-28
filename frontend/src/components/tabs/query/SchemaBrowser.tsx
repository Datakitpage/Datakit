import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useDuckDBStore } from "@/store/duckDBStore";
import { usePostgreSQLStore } from "@/store/postgresStore";
import {
  Database,
  Table,
  Eye,
  ChevronRight,
  ChevronDown,
  FileText,
  Hash,
  Calendar,
  Check,
  Type,
  Layers,
  RefreshCw,
  HardDrive,
  Cloud,
  Loader2,
  Server,
  Plus,
} from "lucide-react";
import Tooltip from "@/components/ui/Tooltip";

interface SchemaBrowserProps {
  onInsertQuery: (text: string) => void;
}

interface TableSchema {
  name: string;
  type: "table" | "view";
  source: "local" | "motherduck";
  database?: string;
  columns: {
    name: string;
    type: string;
  }[];
  rowCount?: number;
}

/**
 * Enhanced schema browser showing both local and MotherDuck tables
 */
const SchemaBrowser: React.FC<SchemaBrowserProps> = ({ onInsertQuery }) => {
  const {
    // Local state
    getAvailableTables,
    registeredTables,
    executeQuery,
    lastTableRefresh,
    getObjectType,
    
    motherDuckConnected,
    motherDuckDatabases,
    motherDuckSchemas,
    refreshMotherDuckSchemas,
    executeMotherDuckQuery,
    
    listAttachedDatabases,
    
    // PostgreSQL bridge state
    postgresConnections,
    postgresActiveConnections,
    postgresVirtualTables,
    postgresSchemas,
    postgresError,
    connectToPostgreSQL,
    disconnectFromPostgreSQL,
    addVirtualPostgreSQLTable,
    refreshPostgreSQLVirtualSchemas,
  } = useDuckDBStore();
  
  // PostgreSQL store for connection management
  const {
    connections: allPostgresConnections,
    loadConnections: loadPostgresConnections,
  } = usePostgreSQLStore();

  const [localSchemas, setLocalSchemas] = useState<Record<string, TableSchema>>({});
  const [motherDuckTableSchemas, setMotherDuckTableSchemas] = useState<Record<string, TableSchema>>({});
  const [attachedDatabases, setAttachedDatabases] = useState<Array<{ name: string; tables: number }>>([]);
  const [attachedDbSchemas, setAttachedDbSchemas] = useState<Record<string, TableSchema>>({});
  const [expandedDatabases, setExpandedDatabases] = useState<Set<string>>(new Set(["local"]));
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [localLoading, setLocalLoading] = useState<boolean>(true);
  const [localRefreshing, setLocalRefreshing] = useState<boolean>(false);
  const [motherDuckRefreshing, setMotherDuckRefreshing] = useState<Set<string>>(new Set());
  const [attachedDbRefreshing, setAttachedDbRefreshing] = useState<Set<string>>(new Set());
  const [loadingColumns, setLoadingColumns] = useState<Set<string>>(new Set());
  const [postgresRefreshing, setPostgresRefreshing] = useState<Set<string>>(new Set());
  const [postgresConnecting, setPostgresConnecting] = useState<Set<string>>(new Set());

  // Dependency tracking for local tables
  const localDependencyKey = useMemo(() => {
    const tableNames = getAvailableTables().sort().join(',');
    const registeredKeys = Array.from(registeredTables.keys()).sort().join(',');
    return `${tableNames}-${registeredKeys}-${lastTableRefresh}`;
  }, [getAvailableTables, registeredTables, lastTableRefresh]);

  const fetchLocalSchemas = useCallback(async () => {
    setLocalLoading(true);
    try {
      const objectNames = getAvailableTables();
      const schemaData: Record<string, TableSchema> = {};

      for (const objectName of objectNames) {
        // Skip attached database tables (they have dots in their names)
        if (objectName.includes('.')) {
          continue;
        }
        
        try {
          const objectType = await getObjectType(objectName);
          const result = await executeQuery(`DESCRIBE "${objectName}"`);

          if (result) {
            const columns = result.toArray().map((row) => ({
              name: row.column_name || row.name || "",
              type: row.column_type || row.type || "",
            }));

            schemaData[objectName] = {
              name: objectName,
              type: objectType || "table",
              source: "local",
              columns,
            };
          }
        } catch (err) {
          console.error(`Error fetching schema for ${objectName}:`, err);
          schemaData[objectName] = {
            name: objectName,
            type: "table",
            source: "local",
            columns: [],
          };
        }
      }

      setLocalSchemas(schemaData);
    } catch (err) {
      console.error("Error fetching local schemas:", err);
    } finally {
      setLocalLoading(false);
    }
  }, [getAvailableTables, getObjectType, executeQuery]);
  
  // Fetch attached databases and their tables
  const fetchAttachedDatabases = useCallback(async () => {
    try {
      const attached = await listAttachedDatabases();
      setAttachedDatabases(attached);
      
      // Fetch schemas for attached database tables
      const schemaData: Record<string, TableSchema> = {};
      const allTables = getAvailableTables();
      
      // Filter tables that belong to attached databases (contain dots)
      for (const tableName of allTables) {
        if (tableName.includes('.')) {
          const [dbName, ...tableNameParts] = tableName.split('.');
          const actualTableName = tableNameParts.join('.');
          
          // Check if this database is in our attached list
          if (attached.some(db => db.name === dbName)) {
            try {
              const qualifiedName = registeredTables.get(tableName) || `"${dbName}"."${actualTableName}"`;
              console.log(`[SchemaBrowser] Describing table ${tableName}, using qualified name: ${qualifiedName}`);
              console.log(`[SchemaBrowser] Available registered tables:`, Array.from(registeredTables.keys()));
              const result = await executeQuery(`DESCRIBE ${qualifiedName}`);
              
              if (result) {
                const columns = result.toArray().map((row) => ({
                  name: row.column_name || row.name || "",
                  type: row.column_type || row.type || "",
                }));
                
                schemaData[tableName] = {
                  name: actualTableName,
                  type: "table",
                  source: "local",
                  database: dbName,
                  columns,
                };
              }
            } catch (err) {
              console.error(`Error fetching schema for ${tableName}:`, err);
              schemaData[tableName] = {
                name: actualTableName,
                type: "table",
                source: "local",
                database: dbName,
                columns: [],
              };
            }
          }
        }
      }
      
      setAttachedDbSchemas(schemaData);
    } catch (err) {
      console.error("Error fetching attached databases:", err);
    }
  }, [listAttachedDatabases, getAvailableTables, registeredTables, executeQuery]);

  // Fetch MotherDuck table columns on demand
  const fetchMotherDuckTableColumns = useCallback(async (database: string, tableName: string) => {
    const tableId = `${database}.${tableName}`;
    
    // Skip if already loaded or currently loading
    if (motherDuckTableSchemas[tableId]?.columns?.length > 0 || loadingColumns.has(tableId)) {
      return;
    }

    setLoadingColumns(prev => new Set(prev).add(tableId));

    try {
      const result = await executeMotherDuckQuery(
        `DESCRIBE "${database}"."${tableName}"`,
        database
      );

      if (result && Array.isArray(result)) {
        const columns = result.map((row: any) => ({
          name: row.column_name || row.name || "",
          type: row.column_type || row.type || "",
        }));

        setMotherDuckTableSchemas(prev => ({
          ...prev,
          [tableId]: {
            name: tableName,
            type: motherDuckSchemas.get(database)?.find(s => s.name === tableName)?.type as "table" | "view" || "table",
            source: "motherduck",
            database,
            columns,
          }
        }));
      }
    } catch (err) {
      console.error(`Error fetching columns for ${database}.${tableName}:`, err);
    } finally {
      setLoadingColumns(prev => {
        const next = new Set(prev);
        next.delete(tableId);
        return next;
      });
    }
  }, [executeMotherDuckQuery, motherDuckSchemas, motherDuckTableSchemas]);

  // Load available PostgreSQL connections on mount
  useEffect(() => {
    loadPostgresConnections().catch(console.error);
  }, [loadPostgresConnections]);

  // PostgreSQL connection handlers
  const handlePostgreSQLConnect = async (connectionId: string) => {
    if (postgresConnecting.has(connectionId)) return;
    
    setPostgresConnecting(prev => new Set(prev).add(connectionId));
    try {
      await connectToPostgreSQL(connectionId);
      await refreshPostgreSQLVirtualSchemas(connectionId);
    } catch (error) {
      console.error('Failed to connect to PostgreSQL:', error);
    } finally {
      setPostgresConnecting(prev => {
        const next = new Set(prev);
        next.delete(connectionId);
        return next;
      });
    }
  };

  // TODO: Maybe we want to give user ability to disconnect in the next iterations?
  //
  // const handlePostgreSQLDisconnect = async (connectionId: string) => {
  //   try {
  //     await disconnectFromPostgreSQL(connectionId);
  //   } catch (error) {
  //     console.error('Failed to disconnect from PostgreSQL:', error);
  //   }
  // };

  const handlePostgreSQLRefresh = async (connectionId: string) => {
    if (postgresRefreshing.has(connectionId)) return;
    
    setPostgresRefreshing(prev => new Set(prev).add(connectionId));
    try {
      await refreshPostgreSQLVirtualSchemas(connectionId);
    } catch (error) {
      console.error('Failed to refresh PostgreSQL schemas:', error);
    } finally {
      setPostgresRefreshing(prev => {
        const next = new Set(prev);
        next.delete(connectionId);
        return next;
      });
    }
  };


  // Fetch local schemas when dependencies change
  useEffect(() => {
    fetchLocalSchemas();
    fetchAttachedDatabases();
  }, [localDependencyKey]);

  // Handle local refresh
  const handleLocalRefresh = async () => {
    if (localRefreshing) return;
    setLocalRefreshing(true);
    try {
      await fetchLocalSchemas();
      await fetchAttachedDatabases();
    } finally {
      setLocalRefreshing(false);
    }
  };
  
  // Handle attached database refresh
  const handleAttachedDbRefresh = async (databaseName: string) => {
    if (attachedDbRefreshing.has(databaseName)) return;
    
    setAttachedDbRefreshing(prev => new Set(prev).add(databaseName));
    try {
      // Re-fetch the schemas for this specific database
      await fetchAttachedDatabases();
    } finally {
      setAttachedDbRefreshing(prev => {
        const next = new Set(prev);
        next.delete(databaseName);
        return next;
      });
    }
  };

  // Handle MotherDuck database refresh
  const handleMotherDuckRefresh = async (databaseName: string) => {
    if (motherDuckRefreshing.has(databaseName)) return;
    
    setMotherDuckRefreshing(prev => new Set(prev).add(databaseName));
    try {
      await refreshMotherDuckSchemas(databaseName);
      // Clear cached columns for this database
      const keysToRemove = Object.keys(motherDuckTableSchemas).filter(key => 
        key.startsWith(`${databaseName}.`)
      );
      setMotherDuckTableSchemas(prev => {
        const next = { ...prev };
        keysToRemove.forEach(key => delete next[key]);
        return next;
      });
    } catch (err) {
      console.error(`Failed to refresh MotherDuck schemas for ${databaseName}:`, err);
    } finally {
      setMotherDuckRefreshing(prev => {
        const next = new Set(prev);
        next.delete(databaseName);
        return next;
      });
    }
  };

  const toggleDatabase = async (dbId: string) => {
    const isExpanding = !expandedDatabases.has(dbId);
    
    // If expanding a MotherDuck database and schemas not loaded, auto-refresh
    if (isExpanding && dbId !== 'local' && motherDuckConnected) {
      const schemas = motherDuckSchemas.get(dbId);
      if (!schemas || schemas.length === 0) {
        await handleMotherDuckRefresh(dbId);
      }
    }
    
    setExpandedDatabases(prev => {
      const next = new Set(prev);
      if (next.has(dbId)) {
        next.delete(dbId);
      } else {
        next.add(dbId);
      }
      return next;
    });
  };

  const toggleTable = async (tableId: string) => {
    // If it's a MotherDuck table and we're expanding it, fetch columns
    if (!expandedTables.has(tableId) && tableId.includes('.')) {
      const [database, ...tableNameParts] = tableId.split('.');
      const tableName = tableNameParts.join('.'); // Handle table names with dots
      if (database !== 'local') {
        await fetchMotherDuckTableColumns(database, tableName);
      }
    }

    setExpandedTables(prev => {
      const next = new Set(prev);
      if (next.has(tableId)) {
        next.delete(tableId);
      } else {
        next.add(tableId);
      }
      return next;
    });
  };

  const generateSelectQuery = (schema: TableSchema) => {
    let query: string;
    
    if (schema.source === 'local' && schema.database) {
      // Attached database table
      const fullTableName = `${schema.database}.${schema.name}`;
      const escapedName = registeredTables.get(fullTableName) || `"${schema.database}"."${schema.name}"`;
      query = `\nSELECT *\nFROM ${escapedName}\nLIMIT 10;`;
    } else if (schema.source === 'local') {
      // Regular local table
      const escapedName = registeredTables.get(schema.name) || `"${schema.name}"`;
      query = `\nSELECT *\nFROM ${escapedName}\nLIMIT 10;`;
    } else if (schema.source === 'postgresql') {
      // PostgreSQL table - use proper PostgreSQL syntax
      const tableRef = `"${schema.database}"."${schema.name}"`;
      query = `\nSELECT *\nFROM ${tableRef}\nLIMIT 10;`;
    } else {
      // MotherDuck table
      const tableRef = schema.database ? `"${schema.database}"."${schema.name}"` : `"${schema.name}"`;
      query = `\nSELECT *\nFROM ${tableRef}\nLIMIT 10;`;
    }
    
    onInsertQuery(query);
  };

  const generateColumnQuery = (schema: TableSchema, columnName: string) => {
    let query: string;
    
    if (schema.source === 'local' && schema.database) {
      // Attached database table
      const fullTableName = `${schema.database}.${schema.name}`;
      const escapedName = registeredTables.get(fullTableName) || `"${schema.database}"."${schema.name}"`;
      query = `\nSELECT "${columnName}"\nFROM ${escapedName}\nLIMIT 10;`;
    } else if (schema.source === 'local') {
      // Regular local table
      const escapedName = registeredTables.get(schema.name) || `"${schema.name}"`;
      query = `\nSELECT "${columnName}"\nFROM ${escapedName}\nLIMIT 10;`;
    } else if (schema.source === 'postgresql') {
      // PostgreSQL table - use proper PostgreSQL syntax
      const tableRef = `"${schema.database}"."${schema.name}"`;
      query = `\nSELECT "${columnName}"\nFROM ${tableRef}\nLIMIT 10;`;
    } else {
      // MotherDuck table
      const tableRef = schema.database ? `"${schema.database}"."${schema.name}"` : `"${schema.name}"`;
      query = `\nSELECT "${columnName}"\nFROM ${tableRef}\nLIMIT 10;`;
    }
    
    onInsertQuery(query);
  };

  const getObjectIcon = (type: "table" | "view") => {
    if (type === "view") {
      return <Eye size={14} className="text-blue-400" />;
    }
    return <Table size={14} className="text-primary" />;
  };

  const getColumnTypeIcon = (type: string) => {
    const lowerType = type.toLowerCase();
    if (lowerType.includes("int") || lowerType.includes("float") || lowerType.includes("double") || lowerType.includes("numeric")) {
      return <Hash size={12} className="text-yellow-400" />;
    }
    if (lowerType.includes("date") || lowerType.includes("time")) {
      return <Calendar size={12} className="text-green-400" />;
    }
    if (lowerType.includes("bool")) {
      return <Check size={12} className="text-blue-400" />;
    }
    return <Type size={12} className="text-muted-foreground" />;
  };

  // Prepare data
  const localTables = Object.values(localSchemas);
  const localTablesData = localTables.filter(s => s.type === "table");
  const localViewsData = localTables.filter(s => s.type === "view");

  // Check if we have any data to show
  const hasLocalData = localTablesData.length > 0 || localViewsData.length > 0;
  const hasMotherDuckData = motherDuckConnected && motherDuckDatabases.length > 0;
  const hasPostgreSQLData = postgresActiveConnections.size > 0 || allPostgresConnections.length > 0;
  const hasAnyData = hasLocalData || hasMotherDuckData || hasPostgreSQLData;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium flex items-center">
            <Database size={16} className="mr-2 text-primary" />
            Schema Browser
          </h3>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {/* Show empty state if no data at all */}
        {!hasAnyData && !localLoading ? (
          <div className="px-4 py-8 text-center text-muted-foreground text-xs">
            No data available. Import files to get started.
          </div>
        ) : (
          <>
            {/* Local Database Section - Always show if there's any local data or still loading */}
            {(hasLocalData || localLoading) && (
              <div className="border-b border-border">
                {/* Database Header */}
                <div className="flex items-center justify-between px-2 py-2 hover:bg-accent/5 cursor-pointer"
                     onClick={() => toggleDatabase('local')}>
                  <div className="flex items-center space-x-2">
                    <span className="text-muted-foreground">
                      {expandedDatabases.has('local') ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </span>
                    <HardDrive size={14} className="text-primary" />
                    <span className="text-sm font-medium text-foreground">Local</span>
                    <span className="text-xs text-muted-foreground">
                      ({localTablesData.length + localViewsData.length})
                    </span>
                  </div>
                  <Tooltip placement="left" content="Refresh schemas">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLocalRefresh();
                      }}
                      disabled={localRefreshing}
                      className="p-1 hover:bg-accent/10 rounded text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <RefreshCw size={12} className={localRefreshing ? "animate-spin" : ""} />
                    </button>
                  </Tooltip>
                </div>

                {/* Database Content */}
                {expandedDatabases.has('local') && (
                  <div className="pl-6">
                    {localLoading ? (
                      <div className="flex items-center justify-center py-4 text-muted-foreground">
                        <Loader2 size={16} className="animate-spin mr-2" />
                        <span className="text-sm">Loading local schemas...</span>
                      </div>
                    ) : localTables.length === 0 ? (
                      <div className="px-2 py-4 text-center text-muted-foreground text-sm">
                        No local tables. Import data to get started.
                      </div>
                    ) : (
                      <div className="py-1">
                        {/* Tables Section */}
                        {localTablesData.length > 0 && (
                          <div className="mb-2">
                            <div className="flex items-center px-2 py-1 text-xs font-medium text-muted-foreground">
                              <Layers size={12} className="mr-1" />
                              Tables ({localTablesData.length})
                            </div>
                            {localTablesData.map(schema => (
                              <TableItem
                                key={schema.name}
                                schema={schema}
                                tableId={`local.${schema.name}`}
                                isExpanded={expandedTables.has(`local.${schema.name}`)}
                                onToggle={() => toggleTable(`local.${schema.name}`)}
                                onGenerateQuery={generateSelectQuery}
                                onGenerateColumnQuery={generateColumnQuery}
                                getObjectIcon={getObjectIcon}
                                getColumnTypeIcon={getColumnTypeIcon}
                              />
                            ))}
                          </div>
                        )}

                        {/* Views Section */}
                        {localViewsData.length > 0 && (
                          <div className="mb-2">
                            <div className="flex items-center px-2 py-1 text-xs font-medium text-muted-foreground">
                              <Eye size={12} className="mr-1" />
                              Views ({localViewsData.length})
                            </div>
                            {localViewsData.map(schema => (
                              <TableItem
                                key={schema.name}
                                schema={schema}
                                tableId={`local.${schema.name}`}
                                isExpanded={expandedTables.has(`local.${schema.name}`)}
                                onToggle={() => toggleTable(`local.${schema.name}`)}
                                onGenerateQuery={generateSelectQuery}
                                onGenerateColumnQuery={generateColumnQuery}
                                getObjectIcon={getObjectIcon}
                                getColumnTypeIcon={getColumnTypeIcon}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Attached DuckDB Database Sections */}
            {attachedDatabases.map((db) => {
              // Get tables for this attached database
              const dbTables = Object.entries(attachedDbSchemas)
                .filter(([key]) => key.startsWith(`${db.name}.`))
                .map(([key, schema]) => schema);
              
              const isExpanded = expandedDatabases.has(db.name);

              return (
                <div key={db.name} className="border-b border-border">
                  {/* Database Header */}
                  <div className="flex items-center justify-between px-2 py-2 hover:bg-accent/5 cursor-pointer"
                       onClick={() => toggleDatabase(db.name)}>
                    <div className="flex items-center space-x-2">
                      <span className="text-muted-foreground">
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </span>
                      <HardDrive size={14} className="text-blue-400" />
                      <Tooltip placement="top" content={`Attached: ${db.name}.duckdb`}>
                        <span className="text-sm font-medium text-foreground truncate max-w-[120px] block">
                          {db.name}
                        </span>
                      </Tooltip>
                      <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">
                        Attached
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({dbTables.length})
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Tooltip placement="left" content="Refresh tables">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAttachedDbRefresh(db.name);
                          }}
                          disabled={attachedDbRefreshing.has(db.name)}
                          className="p-1 hover:bg-accent/10 rounded text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <RefreshCw size={12} className={attachedDbRefreshing.has(db.name) ? "animate-spin" : ""} />
                        </button>
                      </Tooltip>
                    </div>
                  </div>

                  {/* Database Content */}
                  {isExpanded && (
                    <div className="pl-6">
                      {attachedDbRefreshing.has(db.name) ? (
                        <div className="flex items-center justify-center py-4 text-muted-foreground">
                          <Loader2 size={16} className="animate-spin mr-2" />
                          <span className="text-sm">Loading {db.name} tables...</span>
                        </div>
                      ) : dbTables.length === 0 ? (
                        <div className="px-2 py-4 text-center text-muted-foreground text-sm">
                          No tables found in {db.name}
                        </div>
                      ) : (
                        <div className="py-1">
                          <div className="mb-2">
                            <div className="flex items-center px-2 py-1 text-xs font-medium text-muted-foreground">
                              <Layers size={12} className="mr-1" />
                              Tables ({dbTables.length})
                            </div>
                            {dbTables.map(schema => {
                              const tableId = `${db.name}.${schema.name}`;
                              return (
                                <TableItem
                                  key={tableId}
                                  schema={schema}
                                  tableId={tableId}
                                  isExpanded={expandedTables.has(tableId)}
                                  onToggle={() => toggleTable(tableId)}
                                  onGenerateQuery={generateSelectQuery}
                                  onGenerateColumnQuery={generateColumnQuery}
                                  getObjectIcon={getObjectIcon}
                                  getColumnTypeIcon={getColumnTypeIcon}
                                />
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* MotherDuck Database Sections - Only show if connected */}
            {motherDuckConnected && motherDuckDatabases.map((db) => {
              const schemas = motherDuckSchemas.get(db.name) || [];
              const tables = schemas.filter(s => s.type === 'table');
              const views = schemas.filter(s => s.type === 'view');
              const isExpanded = expandedDatabases.has(db.name);

              return (
                <div key={db.name} className="border-b border-border">
                  {/* Database Header */}
                  <div className="flex items-center justify-between px-2 py-2 hover:bg-accent/5 cursor-pointer"
                       onClick={() => toggleDatabase(db.name)}>
                    <div className="flex items-center space-x-2">
                      <span className="text-muted-foreground">
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </span>
                      <Cloud size={16} className="text-orange-300" />
                      <Tooltip placement="top" content={db.name}>
                        <span className="text-sm font-medium text-foreground truncate max-w-[120px] block">
                          {db.name}
                        </span>
                      </Tooltip>
                      {db.shared && (
                        <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">
                          Shared
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        ({tables.length + views.length})
                      </span>
                    </div>
                    <Tooltip placement="left" content={`Refresh schemas`}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMotherDuckRefresh(db.name);
                        }}
                        disabled={motherDuckRefreshing.has(db.name)}
                        className="p-1 hover:bg-accent/10 rounded text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <RefreshCw size={12} className={motherDuckRefreshing.has(db.name) ? "animate-spin" : ""} />
                      </button>
                    </Tooltip>
                  </div>

                  {/* Database Content */}
                  {isExpanded && (
                    <div className="pl-6">
                      {motherDuckRefreshing.has(db.name) ? (
                        <div className="flex items-center justify-center py-4 text-muted-foreground">
                          <Loader2 size={16} className="animate-spin mr-2" />
                          <span className="text-xs">Loading {db.name} schemas...</span>
                        </div>
                      ) : schemas.length === 0 ? (
                        <div className="px-2 py-4 text-center text-muted-foreground text-xs">
                          No tables found in {db.name}
                        </div>
                      ) : (
                        <div className="py-1">
                          {/* Tables Section */}
                          {tables.length > 0 && (
                            <div className="mb-2">
                              <div className="flex items-center px-2 py-1 text-xs font-medium text-muted-foreground">
                                <Layers size={12} className="mr-1" />
                                Tables ({tables.length})
                              </div>
                              {tables.map(table => {
                                const tableId = `${db.name}.${table.name}`;
                                const schema = motherDuckTableSchemas[tableId] || {
                                  name: table.name,
                                  type: table.type as "table" | "view",
                                  source: "motherduck" as const,
                                  database: db.name,
                                  columns: [],
                                };

                                return (
                                  <TableItem
                                    key={tableId}
                                    schema={schema}
                                    tableId={tableId}
                                    isExpanded={expandedTables.has(tableId)}
                                    isLoadingColumns={loadingColumns.has(tableId)}
                                    onToggle={() => toggleTable(tableId)}
                                    onGenerateQuery={generateSelectQuery}
                                    onGenerateColumnQuery={generateColumnQuery}
                                    getObjectIcon={getObjectIcon}
                                    getColumnTypeIcon={getColumnTypeIcon}
                                  />
                                );
                              })}
                            </div>
                          )}

                          {/* Views Section */}
                          {views.length > 0 && (
                            <div className="mb-2">
                              <div className="flex items-center px-2 py-1 text-xs font-medium text-muted-foreground">
                                <Eye size={12} className="mr-1" />
                                Views ({views.length})
                              </div>
                              {views.map(view => {
                                const tableId = `${db.name}.${view.name}`;
                                const schema = motherDuckTableSchemas[tableId] || {
                                  name: view.name,
                                  type: view.type as "table" | "view",
                                  source: "motherduck" as const,
                                  database: db.name,
                                  columns: [],
                                };

                                return (
                                  <TableItem
                                    key={tableId}
                                    schema={schema}
                                    tableId={tableId}
                                    isExpanded={expandedTables.has(tableId)}
                                    isLoadingColumns={loadingColumns.has(tableId)}
                                    onToggle={() => toggleTable(tableId)}
                                    onGenerateQuery={generateSelectQuery}
                                    onGenerateColumnQuery={generateColumnQuery}
                                    getObjectIcon={getObjectIcon}
                                    getColumnTypeIcon={getColumnTypeIcon}
                                  />
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* PostgreSQL Connections Section */}
            {hasPostgreSQLData && (
              <>
                {/* Available PostgreSQL Connections */}
                {allPostgresConnections.filter(conn => !postgresActiveConnections.has(conn.id)).map((connection) => (
                  <div key={`pg-available-${connection.id}`} className="border-b border-border">
                    <div className="flex items-center justify-between px-2 py-2 hover:bg-accent/5">
                      <div className="flex items-center space-x-2">
                        <Server size={14} className="text-blue-400" />
                        <span className="text-sm font-medium text-foreground">
                          {connection.name}
                        </span>
                        <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">
                          Available
                        </span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Tooltip placement="left" content="Connect and browse tables">
                          <button
                            onClick={() => handlePostgreSQLConnect(connection.id)}
                            disabled={postgresConnecting.has(connection.id)}
                            className="p-1 hover:bg-accent/10 rounded text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {postgresConnecting.has(connection.id) ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Plus size={12} />
                            )}
                          </button>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Active PostgreSQL Connections */}
                {Array.from(postgresActiveConnections).map((connectionId) => {
                  const connection = postgresConnections.get(connectionId);
                  if (!connection) return null;

                  const isExpanded = expandedDatabases.has(`pg-${connectionId}`);
                  const virtualTables = Array.from(postgresVirtualTables.entries())
                    .filter(([_, table]) => table.connectionId === connectionId);

                  return (
                    <div key={`pg-active-${connectionId}`} className="border-b border-border">
                      {/* Connection Header */}
                      <div className="flex items-center justify-between px-2 py-2 hover:bg-accent/5 cursor-pointer"
                           onClick={() => toggleDatabase(`pg-${connectionId}`)}>
                        <div className="flex items-center space-x-2">
                          <span className="text-muted-foreground">
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </span>
                          <Server size={14} className="text-blue-400" />
                          <span className="text-sm font-medium text-foreground">
                            {connection.name}
                          </span>
                          <span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">
                            Connected
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({virtualTables.length})
                          </span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Tooltip placement="left" content="Refresh schemas">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePostgreSQLRefresh(connectionId);
                              }}
                              disabled={postgresRefreshing.has(connectionId)}
                              className="p-1 hover:bg-accent/10 rounded text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <RefreshCw size={12} className={postgresRefreshing.has(connectionId) ? "animate-spin" : ""} />
                            </button>
                          </Tooltip>
                          {/* <Tooltip placement="left" content="Disconnect">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePostgreSQLDisconnect(connectionId);
                              }}
                              className="p-1 hover:bg-accent/10 rounded text-muted-foreground hover:text-red-400 transition-colors"
                            >
                              <Database size={12} />
                            </button>
                          </Tooltip> */}
                        </div>
                      </div>

                      {/* Connection Content */}
                      {isExpanded && (
                        <div className="pl-6">
                          {postgresRefreshing.has(connectionId) ? (
                            <div className="flex items-center justify-center py-4 text-muted-foreground">
                              <Loader2 size={16} className="animate-spin mr-2" />
                              <span className="text-xs">Loading PostgreSQL schemas...</span>
                            </div>
                          ) : virtualTables.length === 0 ? (
                            <div className="px-2 py-4 text-center text-muted-foreground text-xs">
                              No tables found. Click refresh to load schemas.
                            </div>
                          ) : (
                            <div className="py-1">
                              {/* Group virtual tables by schema, then by type */}
                              {(() => {
                                const schemaGroups = new Map();
                                virtualTables.forEach(([tableKey, table]) => {
                                  if (!schemaGroups.has(table.schemaName)) {
                                    schemaGroups.set(table.schemaName, { tables: [], views: [] });
                                  }
                                  const group = schemaGroups.get(table.schemaName);
                                  if (table.tableType === 'view') {
                                    group.views.push({ tableKey, table });
                                  } else {
                                    group.tables.push({ tableKey, table });
                                  }
                                });

                                return Array.from(schemaGroups.entries()).map(([schemaName, { tables, views }]) => (
                                  <div key={`${connectionId}-${schemaName}`} className="mb-3">
                                    <div className="flex items-center px-2 py-1 text-xs font-medium text-muted-foreground">
                                      <Database size={12} className="mr-1" />
                                      {schemaName} ({tables.length + views.length})
                                    </div>
                                    
                                    {/* Tables Section */}
                                    {tables.length > 0 && (
                                      <div className="mb-2">
                                        <div className="flex items-center px-4 py-1 text-xs font-medium text-muted-foreground">
                                          <Layers size={10} className="mr-1" />
                                          Tables ({tables.length})
                                        </div>
                                        {tables.map(({ tableKey, table }) => {
                                      const fullTableId = `pg-${tableKey}`;
                                      const tableSchema: TableSchema = {
                                        name: table.tableName,
                                        type: table.tableType,
                                        source: "postgresql",
                                        database: table.schemaName,
                                        columns: table.columns,
                                      };

                                      return (
                                        <div key={tableKey} className="schema-item group">
                                          <div 
                                            className="flex items-center px-2 py-1.5 hover:bg-accent/5 rounded text-sm cursor-pointer"
                                            onClick={() => toggleTable(fullTableId)}
                                          >
                                            <span className="mr-1.5 text-muted-foreground flex-shrink-0">
                                              {expandedTables.has(fullTableId) ? (
                                                <ChevronDown size={14} />
                                              ) : (
                                                <ChevronRight size={14} />
                                              )}
                                            </span>
                                            
                                            <span className="flex-shrink-0">
                                              {getObjectIcon(table.tableType)}
                                            </span>
                                            
                                            <div className="flex-1 min-w-0 ml-1.5">
                                              <span className="text-foreground truncate block">
                                                {table.tableName}
                                              </span>
                                            </div>
                                            
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                              <Tooltip placement="left" content="Insert SELECT query">
                                                <button
                                                  className="text-muted-foreground hover:text-primary p-1"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    generateSelectQuery(tableSchema);
                                                  }}
                                                >
                                                  <FileText size={12} />
                                                </button>
                                              </Tooltip>
                                            </div>
                                          </div>

                                          {/* Table Columns */}
                                          {expandedTables.has(fullTableId) && (
                                            <div className="ml-6 pl-2 border-l border-border mt-1 mb-2">
                                              {table.columns.length > 0 ? (
                                                <div className="space-y-0.5">
                                                  {table.columns.map((column) => (
                                                    <div
                                                      key={`${fullTableId}-${column.name}`}
                                                      className="flex items-center px-2 py-1 hover:bg-accent/5 rounded text-xs group/column"
                                                      onClick={() => generateColumnQuery(tableSchema, column.name)}
                                                    >
                                                      <span className="flex-shrink-0">
                                                        {getColumnTypeIcon(column.type)}
                                                      </span>
                                                      
                                                      <span className="ml-1.5 text-foreground truncate flex-1 min-w-0">
                                                        {column.name}
                                                      </span>
                                                      
                                                      <span className="text-muted-foreground text-xs flex-shrink-0 ml-2 max-w-[60px] truncate">
                                                        {column.type}
                                                      </span>
                                                      
                                                      <button
                                                        className="opacity-0 group-hover/column:opacity-100 hover:text-primary transition-all text-muted-foreground p-0.5 flex-shrink-0 ml-1"
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          generateColumnQuery(tableSchema, column.name);
                                                        }}
                                                      >
                                                        <FileText size={10} />
                                                      </button>
                                                    </div>
                                                  ))}
                                                </div>
                                              ) : (
                                                <div className="px-2 py-2 text-muted-foreground text-xs">
                                                  No columns available
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      );
                                        })}
                                      </div>
                                    )}
                                    
                                    {/* Views Section */}
                                    {views.length > 0 && (
                                      <div className="mb-2">
                                        <div className="flex items-center px-4 py-1 text-xs font-medium text-muted-foreground">
                                          <Eye size={10} className="mr-1" />
                                          Views ({views.length})
                                        </div>
                                        {views.map(({ tableKey, table }) => {
                                          const fullTableId = `pg-${tableKey}`;
                                          const tableSchema: TableSchema = {
                                            name: table.tableName,
                                            type: table.tableType,
                                            source: "postgresql",
                                            database: table.schemaName,
                                            columns: table.columns,
                                          };

                                          return (
                                            <div key={tableKey} className="schema-item group">
                                              <div 
                                                className="flex items-center px-2 py-1.5 hover:bg-accent/5 rounded text-sm cursor-pointer"
                                                onClick={() => toggleTable(fullTableId)}
                                              >
                                                <span className="mr-1.5 text-muted-foreground flex-shrink-0">
                                                  {expandedTables.has(fullTableId) ? (
                                                    <ChevronDown size={14} />
                                                  ) : (
                                                    <ChevronRight size={14} />
                                                  )}
                                                </span>
                                                
                                                <span className="flex-shrink-0">
                                                  {getObjectIcon(table.tableType)}
                                                </span>
                                                
                                                <div className="flex-1 min-w-0 ml-1.5">
                                                  <span className="text-foreground truncate block">
                                                    {table.tableName}
                                                  </span>
                                                </div>
                                                
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                  <Tooltip placement="left" content="Insert SELECT query">
                                                    <button
                                                      className="text-muted-foreground hover:text-primary p-1"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        generateSelectQuery(tableSchema);
                                                      }}
                                                    >
                                                      <FileText size={12} />
                                                    </button>
                                                  </Tooltip>
                                                </div>
                                              </div>

                                              {/* View Columns */}
                                              {expandedTables.has(fullTableId) && (
                                                <div className="ml-6 pl-2 border-l border-border mt-1 mb-2">
                                                  {table.columns.length > 0 ? (
                                                    <div className="space-y-0.5">
                                                      {table.columns.map((column) => (
                                                        <div
                                                          key={`${fullTableId}-${column.name}`}
                                                          className="flex items-center px-2 py-1 hover:bg-accent/5 rounded text-xs group/column"
                                                          onClick={() => generateColumnQuery(tableSchema, column.name)}
                                                        >
                                                          <span className="flex-shrink-0">
                                                            {getColumnTypeIcon(column.type)}
                                                          </span>
                                                          
                                                          <span className="ml-1.5 text-foreground truncate flex-1 min-w-0">
                                                            {column.name}
                                                          </span>
                                                          
                                                          <span className="text-muted-foreground text-xs flex-shrink-0 ml-2 max-w-[60px] truncate">
                                                            {column.type}
                                                          </span>
                                                          
                                                          <button
                                                            className="opacity-0 group-hover/column:opacity-100 hover:text-primary transition-all text-muted-foreground p-0.5 flex-shrink-0 ml-1"
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              generateColumnQuery(tableSchema, column.name);
                                                            }}
                                                          >
                                                            <FileText size={10} />
                                                          </button>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  ) : (
                                                    <div className="px-2 py-2 text-muted-foreground text-xs">
                                                      No columns available
                                                    </div>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                ));
                              })()}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// Table Item Component
interface TableItemProps {
  schema: TableSchema;
  tableId: string;
  isExpanded: boolean;
  isLoadingColumns?: boolean;
  onToggle: () => void;
  onGenerateQuery: (schema: TableSchema) => void;
  onGenerateColumnQuery: (schema: TableSchema, columnName: string) => void;
  getObjectIcon: (type: "table" | "view") => React.ReactNode;
  getColumnTypeIcon: (type: string) => React.ReactNode;
}

const TableItem: React.FC<TableItemProps> = ({ 
  schema, 
  tableId, 
  isExpanded, 
  isLoadingColumns = false,
  onToggle, 
  onGenerateQuery, 
  onGenerateColumnQuery,
  getObjectIcon,
  getColumnTypeIcon 
}) => {
  return (
    <div className="schema-item group">
      {/* Table/View row */}
      <div
        className="flex items-center px-2 py-1.5 hover:bg-accent/5 rounded cursor-pointer text-sm"
        onClick={onToggle}
      >
        <span className="mr-1.5 text-muted-foreground flex-shrink-0">
          {schema.columns.length > 0 || isLoadingColumns ? (
            isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          ) : (
            <div className="w-3.5 h-3.5" />
          )}
        </span>
        
        <span className="flex-shrink-0">
          {getObjectIcon(schema.type)}
        </span>
        
        <Tooltip content={schema.name} placement="top">
          <span className="flex-1 text-foreground truncate ml-1.5 min-w-0">
            {schema.name}
          </span>
        </Tooltip>
        
        <Tooltip placement="top" content="Insert SELECT query">
          <button
            className="opacity-0 group-hover:opacity-100 hover:text-primary transition-all text-muted-foreground p-1 flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onGenerateQuery(schema);
            }}
          >
            <FileText size={12} />
          </button>
        </Tooltip>
      </div>

      {/* Columns */}
      {isExpanded && (
        <div className="ml-6 pl-2 border-l border-border mt-1 mb-2">
          {isLoadingColumns ? (
            <div className="flex items-center py-2 text-muted-foreground text-xs">
              <Loader2 size={12} className="animate-spin mr-1.5" />
              Loading columns...
            </div>
          ) : schema.columns.length > 0 ? (
            <div className="space-y-0.5">
              {schema.columns.map((column) => (
                <div
                  key={`${tableId}-${column.name}`}
                  className="flex items-center px-2 py-1 hover:bg-accent/5 rounded text-xs group/column"
                >
                  <span className="flex-shrink-0">
                    {getColumnTypeIcon(column.type)}
                  </span>
                  
                  <Tooltip content={column.name} placement="top">
                    <span className="ml-1.5 text-foreground truncate flex-1 min-w-0">
                      {column.name}
                    </span>
                  </Tooltip>
                  
                  <Tooltip content={column.type} placement="top">
                    <span className="text-muted-foreground text-xs flex-shrink-0 ml-2 max-w-[60px] truncate">
                      {column.type}
                    </span>
                  </Tooltip>
                  
                  <Tooltip placement="left" content="Insert column query">
                    <button
                      className="opacity-0 group-hover/column:opacity-100 hover:text-primary transition-all text-muted-foreground p-0.5 flex-shrink-0 ml-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        onGenerateColumnQuery(schema, column.name);
                      }}
                    >
                      <FileText size={10} />
                    </button>
                  </Tooltip>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-2 py-2 text-muted-foreground text-xs">
              No columns available
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SchemaBrowser;