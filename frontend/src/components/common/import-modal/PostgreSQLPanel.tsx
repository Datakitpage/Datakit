import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Table,
  Search,
  CheckCircle,
  AlertCircle,
  Loader,
  Trash2,
  Edit,
} from 'lucide-react';

import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/Button';
import AuthGate from '@/components/auth/AuthGate';

import { usePostgreSQLStore } from '@/store/postgresStore';
import { useDuckDBStore } from '@/store/duckDBStore';
import { useAuth } from '@/hooks/auth/useAuth';

import {
  PostgreSQLConnection,
  PostgreSQLTable,
  PostgreSQLImportResult,
  CreateConnectionRequest,
} from '@/types/postgres';

interface PostgreSQLPanelProps {
  onImport: (result: PostgreSQLImportResult) => void;
}

interface ConnectionFormData {
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  schema: string;
  sslEnabled: boolean;
  connectionTimeout: number;
  queryTimeout: number;
}

const PostgreSQLPanel: React.FC<PostgreSQLPanelProps> = ({ onImport }) => {
  const { isAuthenticated } = useAuth();

  const [currentStep, setCurrentStep] = useState<
    'connections' | 'form' | 'tables'
  >('connections');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTables, setSelectedTables] = useState<PostgreSQLTable[]>([]);
  const [editingConnection, setEditingConnection] =
    useState<PostgreSQLConnection | null>(null);
  const [formData, setFormData] = useState<ConnectionFormData>({
    name: '',
    host: '',
    port: 5432,
    database: '',
    username: '',
    password: '',
    schema: 'public',
    sslEnabled: false,
    connectionTimeout: 30,
    queryTimeout: 60000,
  });

  const {
    connections,
    selectedConnection,
    isConnecting,
    connectionError,
    tables,
    isLoadingSchemas,
    isLoadingTables,
    schemaError,
    loadConnections,
    selectConnection,
    createConnection,
    deleteConnection,
    loadSchemas,
    loadTables,
    testConnection,
    clearErrors,
  } = usePostgreSQLStore();

  const {
    connectToPostgreSQL,
    addVirtualPostgreSQLTable
  } = useDuckDBStore();


  useEffect(() => {
    if (isAuthenticated) {
      loadConnections();
    }
  }, [isAuthenticated, loadConnections]);

  // Load schemas and tables when connection is selected
  useEffect(() => {
    if (selectedConnection) {
      loadSchemas(selectedConnection.id).then(() => {
        // Load tables only for the connection's default schema instead of all schemas
        const defaultSchema = selectedConnection.schema || 'public';
        loadTables(selectedConnection.id, defaultSchema);
      });
    }
  }, [selectedConnection, loadSchemas, loadTables]);

  const handleCreateConnection = async () => {
    try {
      clearErrors();

      // Test connection first
      const testResult = await testConnection({
        host: formData.host,
        port: formData.port,
        database: formData.database,
        username: formData.username,
        password: formData.password,
        sslEnabled: formData.sslEnabled,
        connectionTimeout: formData.connectionTimeout,
      });

      if (!testResult.success) {
        throw new Error(testResult.message);
      }

      // Create connection
      const connectionData: CreateConnectionRequest = {
        name: formData.name,
        host: formData.host,
        port: formData.port,
        database: formData.database,
        username: formData.username,
        password: formData.password,
        schema: formData.schema,
        sslEnabled: formData.sslEnabled,
        connectionTimeout: formData.connectionTimeout,
        queryTimeout: formData.queryTimeout,
      };

      await createConnection(connectionData);
      setCurrentStep('tables');
    } catch (error) {
      console.error('Failed to create connection:', error);
    }
  };

  const handleDeleteConnection = async (connection: PostgreSQLConnection) => {
    if (
      confirm(
        `Are you sure you want to delete the connection "${connection.name}"?`
      )
    ) {
      try {
        await deleteConnection(connection.id);
      } catch (error) {
        console.error('Failed to delete connection:', error);
      }
    }
  };

  const handleSelectConnection = (connection: PostgreSQLConnection) => {
    selectConnection(connection);
    setCurrentStep('tables');
  };

  const handleTableSelect = (table: PostgreSQLTable) => {
    setSelectedTables((prev) => {
      const prevArray = prev || [];
      const exists = prevArray.find(
        (t) =>
          t.schemaName === table.schemaName && t.tableName === table.tableName
      );

      if (exists) {
        return prevArray.filter(
          (t) =>
            !(
              t.schemaName === table.schemaName &&
              t.tableName === table.tableName
            )
        );
      } else {
        return [...prevArray, table];
      }
    });
  };

  const handleImportTables = async () => {
    if (!selectedConnection || selectedTables.length === 0) return;

    try {
      await connectToPostgreSQL(selectedConnection.id);

      // Add each selected table as a virtual table in DuckDB bridge
      for (const table of selectedTables) {
        const columns =
          table.columns?.map((col) => ({
            name: col.columnName,
            type: col.dataType,
          })) || [];

        addVirtualPostgreSQLTable(selectedConnection.id, table, columns);

        // Create individual file entry for each table (like file imports do)
        const tableFileName = `${table.schemaName}.${table.tableName}`;

        onImport({
          data: [], // Empty for remote tables
          columnTypes:
            table.columns?.map((col) => ({
              name: col.columnName,
              type: col.dataType,
            })) || [],
          fileName: tableFileName,
          rowCount: table.rowCount || 0,
          columnCount: table.columns?.length || 0,
          sourceType: 'postgres' as any,
          loadedToDuckDB: false,
          tableName: tableFileName, // Use schema.table as tableName for DuckDB queries
          isRemote: true,
          remoteProvider: 'postgresql' as any,
          remoteURL: `postgres://${selectedConnection.host}:${selectedConnection.port}/${selectedConnection.database}`,
          postgresql: {
            connectionId: selectedConnection.id,
            connectionName: selectedConnection.name,
            schema: table.schemaName,
            table: table.tableName,
            originalRowCount: table.rowCount || 0,
            queryUsed: `SELECT * FROM "${table.schemaName}"."${table.tableName}"`,
          },
        });
      }
    } catch (error) {
      console.error('Failed to import tables:', error);
    }
  };

  const filteredTables = (tables || []).filter(
    (table) =>
      table.tableName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      table.schemaName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderConnectionsList = () => (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-foreground">
              PostgreSQL Connections
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Connect to your PostgreSQL databases
            </p>
          </div>
          <Button
            onClick={() => setCurrentStep('form')}
            className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Connection
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {connectionError && (
        <div className="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <div className="flex items-center text-red-400">
            <AlertCircle className="h-4 w-4 mr-2" />
            <span className="text-sm">{connectionError}</span>
          </div>
        </div>
      )}

      {/* Connections List */}
      <div className="flex-1 overflow-y-auto p-6">
        {isConnecting ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="h-6 w-6 animate-spin text-blue-400" />
            <span className="ml-2 text-muted-foreground">Loading connections...</span>
          </div>
        ) : connections.length === 0 ? (
          <div className="text-center py-12">
            <h4 className="text-lg font-medium text-foreground mb-2">
              No Connections
            </h4>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
              Create your first PostgreSQL connection to start importing data.
            </p>
            <Button
              onClick={() => setCurrentStep('form')}
              className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Connection
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {(connections || []).map((connection) => (
              <motion.div
                key={connection.id}
                className={cn(
                  'group relative p-4 rounded-lg border transition-all duration-200 cursor-pointer',
                  selectedConnection?.id === connection.id
                    ? 'bg-blue-500/10 border-blue-500/30 text-foreground'
                    : 'bg-accent/5 border border-border hover:border-border text-muted-foreground hover:text-foreground'
                )}
                onClick={() => handleSelectConnection(connection)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">
                        {connection.name}
                      </h4>
                      <p className="text-sm opacity-60 truncate">
                        {connection.host}:{connection.port}/
                        {connection.database}
                      </p>
                      <div className="flex items-center mt-1">
                        <div
                          className={cn(
                            'w-2 h-2 rounded-full mr-2',
                            connection.isActive ? 'bg-green-400' : 'bg-red-400'
                          )}
                        />
                        <span className="text-xs opacity-60">
                          {connection.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingConnection(connection);
                        setCurrentStep('form');
                      }}
                      className="h-8 w-8 p-0 hover:bg-white/10"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteConnection(connection);
                      }}
                      className="h-8 w-8 p-0 hover:bg-red-500/20 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderConnectionForm = () => (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-foreground">
              {editingConnection
                ? 'Edit Connection'
                : 'New PostgreSQL Connection'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Enter your PostgreSQL database connection details
            </p>
          </div>
        
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-md space-y-6">
          {/* Basic Info */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Connection Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="My PostgreSQL DB"
              className="w-full p-2 bg-accent/5 border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-500/50"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-foreground mb-2">
                Host
              </label>
              <input
                type="text"
                value={formData.host}
                onChange={(e) =>
                  setFormData({ ...formData, host: e.target.value })
                }
                placeholder="localhost"
                className="w-full p-2 bg-accent/5 border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Port
              </label>
              <input
                type="number"
                value={formData.port}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    port: parseInt(e.target.value) || 5432,
                  })
                }
                placeholder="5432"
                className="w-full p-2 bg-accent/5 border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-500/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Database
            </label>
            <input
              type="text"
              value={formData.database}
              onChange={(e) =>
                setFormData({ ...formData, database: e.target.value })
              }
              placeholder="my_database"
              className="w-full p-2 bg-accent/5 border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-500/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Username
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) =>
                setFormData({ ...formData, username: e.target.value })
              }
              placeholder="username"
              className="w-full p-2 bg-accent/5 border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-500/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Password
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              placeholder="password"
              className="w-full p-2 bg-accent/5 border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-500/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Default Schema
            </label>
            <input
              type="text"
              value={formData.schema}
              onChange={(e) =>
                setFormData({ ...formData, schema: e.target.value })
              }
              placeholder="public"
              className="w-full p-2 bg-accent/5 border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-500/50"
            />
          </div>

          {/* SSL Toggle */}
          <div className="flex items-center space-x-3">
            <input
              id="ssl-enabled"
              type="checkbox"
              checked={formData.sslEnabled}
              onChange={(e) =>
                setFormData({ ...formData, sslEnabled: e.target.checked })
              }
              className="w-4 h-4 rounded border-border bg-accent/5 text-blue-500"
            />
            <label htmlFor="ssl-enabled" className="text-sm text-foreground">
              Enable SSL
            </label>
          </div>
        </div>

        {/* Error Display */}
        {connectionError && (
          <div className="mt-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg max-w-md">
            <div className="flex items-center text-red-400">
              <AlertCircle className="h-4 w-4 mr-2" />
              <span className="text-sm">{connectionError}</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-border">
        <div className="flex justify-end space-x-3">
          <Button
            variant="ghost"
            onClick={() => {
              setCurrentStep('connections');
              setEditingConnection(null);
            }}
            disabled={isConnecting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateConnection}
            disabled={
              isConnecting ||
              !formData.name ||
              !formData.host ||
              !formData.database ||
              !formData.username ||
              !formData.password
            }
            className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 disabled:opacity-50"
          >
            {isConnecting ? (
              <>
                <Loader className="h-4 w-4 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                {editingConnection ? 'Update' : 'Test & Create'}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );

  const renderTableSelector = () => (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-foreground">Select Tables</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Choose tables to connect from {selectedConnection?.name}.
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={() => setCurrentStep('connections')}
            size="sm"
          >
            Back to Connections
          </Button>
        </div>

        {/* Search */}
        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search tables..."
            className="w-full pl-10 pr-4 py-2 bg-accent/5 border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-500/50"
          />
        </div>
      </div>

      {/* Error Display */}
      {schemaError && (
        <div className="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <div className="flex items-center text-red-400">
            <AlertCircle className="h-4 w-4 mr-2" />
            <span className="text-sm">{schemaError}</span>
          </div>
        </div>
      )}

      {/* Tables List */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoadingSchemas || isLoadingTables ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="h-6 w-6 animate-spin text-blue-400" />
            <span className="ml-2 text-muted-foreground">Loading tables...</span>
          </div>
        ) : filteredTables.length === 0 ? (
          <div className="text-center py-12">
            <Table className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-foreground mb-2">
              No Tables Found
            </h4>
            <p className="text-muted-foreground">
              {searchTerm
                ? 'No tables match your search.'
                : 'No tables found in this database.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTables.map((table) => {
              const isSelected = (selectedTables || []).some(
                (t) =>
                  t.schemaName === table.schemaName &&
                  t.tableName === table.tableName
              );

              return (
                <motion.div
                  key={`${table.schemaName}.${table.tableName}`}
                  className={cn(
                    'group p-4 rounded-lg border transition-all duration-200 cursor-pointer',
                    isSelected
                      ? 'bg-blue-500/10 border-blue-500/30'
                      : 'bg-accent/5 border border-border hover:border-border'
                  )}
                  onClick={() => handleTableSelect(table)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div
                        className={cn(
                          'w-8 h-8 rounded-md flex items-center justify-center border',
                          table.tableType === 'table'
                            ? 'bg-green-500/20 border-green-500/30 text-green-400'
                            : 'bg-blue-500/20 border-blue-500/30 text-blue-400'
                        )}
                      >
                        <Table className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="font-medium text-foreground">
                          {table.schemaName}.{table.tableName}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {table.tableType} 
                          {/* •{' '} */}
                          {/* {table.rowCount?.toLocaleString() || '?'} rows */}
                        </p>
                      </div>
                    </div>

                    {isSelected && (
                      <CheckCircle className="h-5 w-5 text-blue-400" />
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {(selectedTables || []).length > 0 && (
        <div className="p-6 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {(selectedTables || []).length} table
              {(selectedTables || []).length === 1 ? '' : 's'} selected
            </span>
            <Button
              variant="outline"
              onClick={handleImportTables}
              className=" hover:border-blue-500"
            >
              Connect Selected Tables
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  if (!isAuthenticated) {
    return (
      <AuthGate
        title="Sign In Required"
        description="PostgreSQL connections require authentication to keep your database credentials secure."
      />
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentStep}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.2 }}
        className="h-full"
      >
        {currentStep === 'connections' && renderConnectionsList()}
        {currentStep === 'form' && renderConnectionForm()}
        {currentStep === 'tables' && renderTableSelector()}
      </motion.div>
    </AnimatePresence>
  );
};

export default PostgreSQLPanel;
