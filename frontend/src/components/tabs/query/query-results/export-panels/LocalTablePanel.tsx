import React, { useState, useEffect } from 'react';
import { Info } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface LocalTablePanelProps {
  results: any[];
  columns: string[];
  query?: string;
  rowCount: number;
  columnCount: number;
  sourceFileName?: string;
  onExport: (config: { tableName: string }) => void;
  isExporting: boolean;
}

const LocalTablePanel: React.FC<LocalTablePanelProps> = ({
  rowCount,
  columnCount,
  sourceFileName,
  onExport,
  isExporting,
}) => {
  const [tableName, setTableName] = useState('');
  const [error, setError] = useState('');

  // Generate suggested name when panel opens
  useEffect(() => {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '').substring(0, 4);
    
    if (sourceFileName) {
      const baseName = sourceFileName
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-zA-Z0-9_]/g, '_')
        .toLowerCase();
      setTableName(`${baseName}_${dateStr}_${timeStr}`);
    } else {
      setTableName(`results_${dateStr}_${timeStr}`);
    }
    setError('');
  }, [sourceFileName]);

  const validateTableName = (name: string): boolean => {
    if (!name.trim()) {
      setError('Table name is required');
      return false;
    }
    
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      setError('Table name must start with a letter or underscore and contain only letters, numbers, and underscores');
      return false;
    }
    
    if (name.length > 63) {
      setError('Table name must be 63 characters or less');
      return false;
    }
    
    const reservedWords = ['select', 'from', 'where', 'table', 'view', 'create', 'drop', 'insert', 'update', 'delete'];
    if (reservedWords.includes(name.toLowerCase())) {
      setError('Table name cannot be a reserved SQL keyword');
      return false;
    }
    
    setError('');
    return true;
  };

  const handleTableNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTableName(value);
    validateTableName(value);
  };

  const handleExport = () => {
    if (validateTableName(tableName)) {
      onExport({ tableName });
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-4">
          {/* Info Box */}
          <div className="bg-primary/10 border border-primary/30 rounded-lg p-3">
            <div className="flex gap-2">
              <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="space-y-1 text-sm">
                <p className="font-medium">How it works:</p>
                <ul className="space-y-1 text-white/80">
                  <li>• The table will appear as a new tab for easy access</li>
                  <li>• You can query this table directly using SQL</li>
                  <li>• This table exists only in your browser - download the file to save permanently</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Dataset Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-lg p-4">
              <div className="text-white/60 text-sm mb-1">Rows to Export</div>
              <div className="text-xl font-semibold">{rowCount.toLocaleString()}</div>
            </div>
            <div className="bg-white/5 rounded-lg p-4">
              <div className="text-white/60 text-sm mb-1">Columns</div>
              <div className="text-xl font-semibold">{columnCount}</div>
            </div>
          </div>

          {/* Table Name Input */}
          <div className="space-y-2">
            <label htmlFor="tableName" className="block text-sm font-medium text-white">
              Table Name
            </label>
            <input
              id="tableName"
              type="text"
              value={tableName}
              onChange={handleTableNameChange}
              className="w-full px-3 py-2 bg-background border border-white/10 rounded-lg focus:outline-none focus:border-primary transition-colors text-white"
              placeholder="Enter table name"
              disabled={isExporting}
              autoFocus
            />
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
            <p className="text-xs text-white/60">
              Choose a descriptive name for your table. Only letters, numbers, and underscores are allowed.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-white/10 p-4 bg-background/50">
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={isExporting || !tableName.trim() || !!error}
            className="min-w-[120px]"
          >
            {isExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                Creating...
              </>
            ) : (
              <>
                Create Table
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LocalTablePanel;