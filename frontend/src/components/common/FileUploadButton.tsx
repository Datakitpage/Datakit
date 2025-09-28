import * as React from "react";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Upload, FileSpreadsheet, FileText, Database, Package, Braces } from "lucide-react";
import duckdb from "@/assets/duckdb.svg";

interface FileUploadButtonProps {
  onFileSelect?: (file: File) => void;
  onFileHandleSelect?: (handle: FileSystemFileHandle, file: File) => void;
  isLoading?: boolean;
  accept?: string;
  className?: string;
  supportLargeFiles?: boolean;
}

export const FileUploadButton = ({
  onFileSelect,
  onFileHandleSelect,
  isLoading = false,
  accept = ".csv,.json,.xlsx,.xls,.parquet,.duckdb,.db,.txt",
  className = "",
  supportLargeFiles = true,
}: FileUploadButtonProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileTypes = [
    { type: "csv", icon: FileSpreadsheet, color: "text-emerald-400", label: "CSV" },
    { type: "json", icon: Braces, color: "text-amber-400", label: "JSON" },
    { type: "excel", icon: FileSpreadsheet, color: "text-teal-400", label: "XLS" },
    { type: "parquet", icon: Package, color: "text-cyan-400", label: "PQT" },
    { type: "txt", icon: FileText, color: "text-slate-400", label: "TXT" },
    { type: "duckdb", icon: Database, color: "text-violet-400", label: "DB" },
  ];

  const handleButtonClick = async () => {
    if (supportLargeFiles && "showOpenFilePicker" in window) {
      try {
        const pickerOpts = {
          types: [
            {
              description: "Data Files",
              accept: {
                "text/csv": [".csv"],
                "application/json": [".json"],
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
                  [".xlsx"],
                "application/vnd.ms-excel": [".xls"],
                "application/x-parquet": [".parquet"],
                "application/vnd.apache.parquet": [".parquet"],
                "text/plain": [".txt"],
                "application/octet-stream": [".duckdb", ".db"],
              },
            },
          ],
          excludeAcceptAllOption: false,
          multiple: false,
        };

        const [fileHandle] = await window.showOpenFilePicker(pickerOpts);

        const file = await fileHandle.getFile();

        const fileSizeMB = file.size / (1024 * 1024);
        console.log(
          `[FileUploadButton] Selected file: ${file.name} (${fileSizeMB.toFixed(
            2
          )}MB)`
        );

        // Use streaming handler if available, otherwise fall back to regular handler
        if (onFileHandleSelect) {
          // 🚀 Pass the handle for streaming, file object only for metadata
          await onFileHandleSelect(fileHandle, file);
        } else if (onFileSelect) {
          // ⚠️ Legacy support: For large files, warn user
          if (fileSizeMB > 800) {
            const proceed = confirm(
              `This file is ${fileSizeMB.toFixed(
                2
              )}MB which may cause memory issues. ` +
                `Continue anyway? (Consider using Chrome to have a better experience.)`
            );
            if (!proceed) return;
          }

          // Legacy: load file into memory (not recommended for large files)
          await onFileSelect(file);
        }
      } catch (err) {
        if (!(err instanceof Error) || err.name !== "AbortError") {
          console.warn(
            "File System Access API failed, falling back to regular input:",
            err
          );
          fileInputRef.current?.click();
        }
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileSizeMB = file.size / (1024 * 1024);
    console.log(
      `[FileUploadButton] Selected file via input: ${
        file.name
      } (${fileSizeMB.toFixed(2)}MB)`
    );

    // For large files through regular input, warn user
    if (fileSizeMB > 900) {
      alert(
        `This file is ${fileSizeMB.toFixed(
          2
        )}MB. For better performance with large files, ` +
          `use a modern browser (Chrome/Edge) with streaming support.`
      );
    }

    if (onFileSelect) {
      await onFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();

    // Only set isDragging to false if not dragging over any children
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      setIsDragging(false);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const fileExt = file.name.split(".").pop()?.toLowerCase();
    const validExtensions = ["csv", "json", "xlsx", "xls", "parquet", "duckdb", "db", "txt"];

    if (!validExtensions.includes(fileExt || "")) {
      alert("Please import a CSV, JSON, Excel, Parquet, TXT, or DuckDB database file");
      return;
    }

    const fileSizeMB = file.size / (1024 * 1024);
    console.log(
      `[FileUploadButton] Dropped file: ${file.name} (${fileSizeMB.toFixed(
        2
      )}MB)`
    );

    if (supportLargeFiles && onFileHandleSelect) {
      try {
        const items = Array.from(e.dataTransfer.items);
        const item = items[0];

        if (item?.getAsFileSystemHandle) {
          const handle = await item.getAsFileSystemHandle();
          if (handle?.kind === "file") {
            console.log(
              "[FileUploadButton] Using streaming import for dropped file"
            );
            await onFileHandleSelect(handle as FileSystemFileHandle, file);
            return;
          }
        }
      } catch (handleError) {
        console.warn(
          "Could not get file handle from drag and drop, using regular file:",
          handleError
        );
      }
    }

    // Fallback to regular file handling
    if (fileSizeMB > 500) {
      alert(
        `This file is ${fileSizeMB.toFixed(2)}MB. For better performance, ` +
          `try using the file picker instead of drag-and-drop for large files.`
      );
    }

    if (onFileSelect) {
      await onFileSelect(file);
    }
  };



  return (
    <div
      className={`relative ${className}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging ? (
        <div className="border-2 border-dashed border-primary py-6 px-3 flex flex-col items-center justify-center transition-colors bg-primary/10 shadow-lg shadow-primary/5 rounded-lg">
          <div className="relative mb-3">
            <Upload className="h-12 w-12 text-primary animate-pulse" />
            <div className="absolute -inset-1.5 border-2 border-dashed border-primary/60 rounded-lg animate-pulse" />
          </div>
          
          <div className="text-center px-2">
            <p className="text-primary font-semibold text-xs mb-1">
              Drop your file here
            </p>
            <p className="text-[10px] text-primary/70">
              Ready to import
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden shadow-sm group hover:shadow-md transition-shadow rounded-lg">
          <Button
            type="button"
            variant="outline"
            className={`w-full bg-accent/5 border border-border hover:border-primary/50 hover:bg-accent/10 transition-all p-0 h-auto rounded-lg ${className}`}
            onClick={handleButtonClick}
            disabled={isLoading}
          >
            <div className="flex flex-col items-center w-full py-6 px-6">
              {isLoading ? (
                <div className="flex flex-col items-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-foreground border-t-transparent mb-2" />
                  <span className="text-sm text-foreground">Processing...</span>
                </div>
              ) : (
                <>
                  <div className="flex flex-col items-center">
                    <div className="text-center mb-4 px-4">
                      <p className="text-sm font-medium text-foreground mb-2">
                        Drop files here or click
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Supports large data files
                      </p>
                    </div>

                    <div className="flex items-center justify-center space-x-2.5 text-muted-foreground">
                      {fileTypes.map((type, index) => {
                        const Icon = type.icon;
                        return (
                          <div key={index} className="flex flex-col items-center group/icon">
                            {type.isImage ? (
                              <img 
                                src={type.icon} 
                                alt={type.label}
                                className="h-5 w-5 group-hover/icon:scale-110 transition-transform"
                              />
                            ) : (
                              <Icon className={`h-5 w-5 ${type.color} group-hover/icon:scale-110 transition-transform`} />
                            )}
                            <span className="text-[10px] mt-1.5 font-mono">{type.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </Button>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={accept}
        onChange={handleFileChange}
        disabled={isLoading}
      />
    </div>
  );
};
