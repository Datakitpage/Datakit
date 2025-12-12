export interface DatabricksConnection {
    id?: string;
    name?: string; // Optional name if we want to save it later
    token: string;
    host: string;
    httpPath: string;
    timeout?: number;
}

export interface DatabricksTable {
    catalog: string;
    schema: string;
    tableName: string;
    tableType?: string;
    columns?: Array<{ name: string; type: string }>; // If we can fetch them
    rowCount?: number;
}

export interface DatabricksVirtualTable {
    connection: DatabricksConnection;
    catalog: string;
    schema: string;
    tableName: string;
    columns: Array<{ name: string; type: string }>;
    isImported: boolean;
}

export interface DatabricksTableGroup {
    catalog: string;
    schema: string;
    tables: any[];
}

export interface DatabricksQueryResult {
    rows: any[];
    columns: any[];
}
