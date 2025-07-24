import * as React from "react";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { useElectronFileUpload } from "@/hooks/useElectronFileUpload";

import csv from "@/assets/csv.png";
import json from "@/assets/json.png";
import xlsx from "@/assets/xlsx.png";
import parquet from "@/assets/parquet.png";

interface FileUploadButtonProps {
  onFileSelect?: (file: File) => void;
  onFileHandleSelect?: (handle: FileSystemFileHandle, file: File) => void;
  isLoading?: boolean;
  accept?: string;
  className?: string;
  supportLargeFiles?: boolean;
  electronStatus?: string | null;
}

export const FileUploadButton = ({
  onFileSelect,
  onFileHandleSelect,
  isLoading = false,
  accept = ".csv,.json,.xlsx,.xls,.parquet",
  className = "",
  supportLargeFiles = true,
  electronStatus = null,
}: FileUploadButtonProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Initialize Electron file handling
  const { isElectron } = useElectronFileUpload({ onFileSelect, onFileHandleSelect });

  const fileTypes = [
    { type: "csv", icon: csv, color: "bg-primary", label: "CSV" },
    { type: "excel", icon: xlsx, color: "bg-green-700", label: "EXCEL" },
    { type: "json", icon: json, color: "bg-amber-100", label: "JSON" },
    { type: "parquet", icon: parquet, color: "bg-sky-200", label: "PARQUET" },
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
    const validExtensions = ["csv", "json", "xlsx", "xls", "parquet"];

    if (!validExtensions.includes(fileExt || "")) {
      alert("Please import a CSV, JSON, Excel, or Parquet file");
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


  const hasStreamingSupport =
    supportLargeFiles && "showOpenFilePicker" in window && onFileHandleSelect;
  const maxSizeText = hasStreamingSupport
    ? "Supports +1GB files"
    : "Supports files up to 1GB";

  return (
    <div
      className={`relative ${className}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging ? (
        <div className="border-2 border-dashed border-primary py-6 px-4 flex flex-col items-center justify-center transition-colors bg-primary/10 shadow-lg shadow-primary/5 rounded-lg">
          <div className="flex justify-center mb-3 gap-2">
            {fileTypes.map((type, index) => (
              <div
                key={index}
                className="transform scale-90 hover:scale-100 transition-transform"
              >
                <img src={type.icon} alt={type.label} className="h-8 w-8" />
              </div>
            ))}
          </div>
          <p className="text-primary font-medium text-sm">
            Drop your file here
          </p>
          <p className="text-xs text-primary/70 mt-1">
            CSV, JSON, Excel, or Parquet
          </p>
        </div>
      ) : (
        <div className="overflow-hidden shadow-sm group hover:shadow-md transition-shadow rounded-lg">
          <Button
            type="button"
            variant="outline"
            className={`w-full bg-white/5 border border-white/20 hover:border-primary/80 hover:bg-black/30 transition-all p-0 h-auto rounded-lg ${className}`}
            onClick={handleButtonClick}
            disabled={isLoading}
          >
            <div className="flex flex-col items-center w-full py-5 px-4">
              {isLoading || electronStatus ? (
                <div className="flex flex-col items-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent mb-2" />
                  <span className="text-sm">{electronStatus || "Processing..."}</span>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {fileTypes.map((type, index) => (
                      <div
                        key={index}
                        className="flex flex-col items-center group-hover:transform group-hover:-translate-y-1 transition-all duration-200"
                      >
                        <img
                          src={type.icon}
                          alt={type.label}
                          className="h-8 w-8"
                        />
                        <div
                          className={`h-1 w-1 rounded-full ${type.color} mt-1`}
                        />
                        <span className={`text-[10px] mt-1`}>{type.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-white/80 mb-1">
                      {isElectron ? "Click to open, drag files, or double-click files on desktop" : "Click to open or drag files here"}
                    </p>
                    <p className="text-[10px] text-white/50">{maxSizeText}</p>
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
