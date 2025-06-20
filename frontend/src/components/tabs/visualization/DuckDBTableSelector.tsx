import React, { useState, useMemo } from "react";
import {
  Database,
  ChevronDown,
  Table,
  Eye,
  Cloud,
  HardDrive,
} from "lucide-react";

import { useDuckDBStore } from "@/store/duckDBStore";

interface DuckDBTable {
  name: string;
  rowCount?: number;
  isView: boolean;
  source: "local" | "motherduck";
  database?: string;
  schema?: { name: string; type: string }[];
}

interface DuckDBTableSelectorProps {
  selectedTable: DuckDBTable | null;
  onTableChange: (table: DuckDBTable) => void;
}

/**
 * Component for selecting DuckDB tables/views instead of files
 */
const DuckDBTableSelector: React.FC<DuckDBTableSelectorProps> = ({
  selectedTable,
  onTableChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const {
    registeredTables,
    schemaCache,
    motherDuckSchemas,
    motherDuckConnected,
    selectedMotherDuckDatabase,
  } = useDuckDBStore();

  // Get all available tables from both local and MotherDuck
  const availableTables = useMemo(() => {
    const tables: DuckDBTable[] = [];

    // Add local tables
    Array.from(registeredTables.keys()).forEach((tableName) => {
      tables.push({
        name: tableName,
        isView: false, // TODO: detect if it's a view
        source: "local",
        schema: schemaCache.get(tableName),
      });
    });

    // Add MotherDuck tables if connected
    if (motherDuckConnected) {
      motherDuckSchemas.forEach((schemas, databaseName) => {
        schemas.forEach((schema) => {
          tables.push({
            name: schema.name,
            isView: schema.type === "view",
            source: "motherduck",
            database: databaseName,
          });
        });
      });
    }

    return tables;
  }, [registeredTables, schemaCache, motherDuckSchemas, motherDuckConnected]);

  // Group tables by source
  const groupedTables = useMemo(() => {
    const local = availableTables.filter((t) => t.source === "local");
    const motherduck = availableTables.filter((t) => t.source === "motherduck");

    const grouped: { [key: string]: DuckDBTable[] } = {};
    
    if (local.length > 0) {
      grouped["Local Tables"] = local;
    }

    // Group MotherDuck tables by database
    motherduck.forEach((table) => {
      const key = `MotherDuck: ${table.database}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(table);
    });

    return grouped;
  }, [availableTables]);

  // Format table display name
  const getTableDisplayName = (table: DuckDBTable) => {
    if (table.source === "motherduck" && table.database) {
      return `${table.database}.${table.name}`;
    }
    return table.name;
  };

  // Get icon for table type
  const getTableIcon = (table: DuckDBTable) => {
    if (table.isView) {
      return <Eye className="w-3 h-3 text-blue-400" />;
    }
    return <Table className="w-3 h-3 text-green-400" />;
  };

  // Get source icon
  const getSourceIcon = (source: "local" | "motherduck") => {
    if (source === "motherduck") {
      return <Cloud className="w-3 h-3 text-purple-400" />;
    }
    return <HardDrive className="w-3 h-3 text-white/50" />;
  };

  return (
    <div className="relative">
      <button
        className="flex items-center gap-2 px-3 py-1.5 bg-darkNav border border-white/10 rounded text-sm hover:bg-white/5 cursor-pointer min-w-[200px]"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Database className="w-4 h-4 text-white/70" />
        <span className="text-white/90 truncate flex-1 text-left">
          {selectedTable ? getTableDisplayName(selectedTable) : "Select table"}
        </span>
        <ChevronDown
          className={`w-3 h-3 text-white/50 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute top-full left-0 mt-1 bg-black border border-white/10 rounded shadow-lg z-50 min-w-[300px] max-h-[400px] overflow-hidden">
            <div className="overflow-y-auto max-h-[390px]">
              {Object.entries(groupedTables).map(([groupName, tables]) => (
                <div key={groupName}>
                  {/* Group header */}
                  <div className="px-3 py-1.5 bg-darkNav/50 border-b border-white/5">
                    <span className="text-xs font-medium text-white/50">
                      {groupName}
                    </span>
                  </div>

                  {/* Tables in group */}
                  {tables.map((table) => (
                    <button
                      key={`${table.source}-${table.database}-${table.name}`}
                      className="w-full px-3 py-2 text-left text-sm text-white/80 hover:bg-white/5 hover:text-white flex items-center gap-2 cursor-pointer"
                      onClick={() => {
                        onTableChange(table);
                        setIsOpen(false);
                      }}
                    >
                      {/* Table type icon */}
                      {getTableIcon(table)}

                      {/* Table info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">
                            {table.name}
                          </span>
                          {getSourceIcon(table.source)}
                        </div>
                        {table.rowCount !== undefined && (
                          <div className="text-xs text-white/40">
                            {table.rowCount.toLocaleString()} rows
                          </div>
                        )}
                      </div>

                      {/* Selection indicator */}
                      {selectedTable &&
                        selectedTable.name === table.name &&
                        selectedTable.source === table.source &&
                        selectedTable.database === table.database && (
                          <div className="w-2 h-2 rounded-full bg-primary" />
                        )}
                    </button>
                  ))}
                </div>
              ))}

              {/* Empty state */}
              {availableTables.length === 0 && (
                <div className="p-4 text-center text-white/50 text-sm">
                  No tables available. Import data to get started.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DuckDBTableSelector;