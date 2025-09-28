// src/components/tabs/visualization/ExportModal.tsx
import React, { useState, useRef } from 'react';
import { useChartsStore } from '@/store/chartsStore';
import { Download, X, Image, FileText, Clipboard, Link } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toPng, toJpeg, toSvg } from 'html-to-image';

/**
 * Modal for exporting charts with various options
 */
const ExportModal: React.FC = () => {
  const { isExportModalOpen, toggleExportModal, currentChart } = useChartsStore();
  const [format, setFormat] = useState<'png' | 'jpeg' | 'svg' | 'csv'>('png');
  const [quality, setQuality] = useState<number>(0.92);
  const [includeTitle, setIncludeTitle] = useState<boolean>(true);
  const [includeDescription, setIncludeDescription] = useState<boolean>(true);
  const [includeBackground, setIncludeBackground] = useState<boolean>(true);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  
  const chartRef = useRef<HTMLElement | null>(null);
  
  if (!isExportModalOpen || !currentChart) return null;
  
  // Get reference to chart element
  const getChartElement = (): HTMLElement | null => {
    if (chartRef.current) return chartRef.current;
    
    // Try to find chart container in the DOM
    const chartElement = document.querySelector('.recharts-wrapper')?.parentElement || null;
    chartRef.current = chartElement;
    return chartElement;
  };
  
  // Export chart based on selected format
  const exportChart = async () => {
    const chartElement = getChartElement();
    if (!chartElement) return;
    
    try {
      let dataUrl;
      const bgColor = includeBackground ? '#1a1b26' : 'transparent';
      
      // Create file name
      const fileName = `${currentChart.title.replace(/\s+/g, '_')}_${Date.now()}`;
      
      switch (format) {
        case 'png':
          dataUrl = await toPng(chartElement, { 
            backgroundColor: bgColor,
            quality,
            filter: createFilter(includeTitle, includeDescription)
          });
          downloadFile(dataUrl, `${fileName}.png`);
          break;
          
        case 'jpeg':
          dataUrl = await toJpeg(chartElement, { 
            backgroundColor: bgColor,
            quality,
            filter: createFilter(includeTitle, includeDescription)
          });
          downloadFile(dataUrl, `${fileName}.jpg`);
          break;
          
        case 'svg':
          dataUrl = await toSvg(chartElement, { 
            backgroundColor: bgColor,
            filter: createFilter(includeTitle, includeDescription)
          });
          downloadFile(dataUrl, `${fileName}.svg`);
          break;
          
        case 'csv':
          exportToCsv(currentChart.data, fileName);
          break;
      }
      
      // Close modal after successful export
      toggleExportModal(false);
    } catch (error) {
      console.error('Error exporting chart:', error);
    }
  };
  
  // Copy chart to clipboard
  const copyToClipboard = async () => {
    const chartElement = getChartElement();
    if (!chartElement) return;
    
    try {
      const dataUrl = await toPng(chartElement, { 
        backgroundColor: includeBackground ? '#1a1b26' : 'transparent',
        quality,
        filter: createFilter(includeTitle, includeDescription)
      });
      
      // Convert data URL to Blob
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      
      // Copy to clipboard using Clipboard API
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob
        })
      ]);
      
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Error copying chart to clipboard:', error);
    }
  };
  
  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-background/60 flex items-center justify-center z-50">
      <div className="bg-popover p-6 rounded-lg shadow-lg w-96 border border-border">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">Export Chart</h3>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => toggleExportModal(false)}
          >
            <X size={16} />
          </Button>
        </div>
        
        <div className="space-y-4">
          {/* Format selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Export Format</label>
            <div className="grid grid-cols-4 gap-2">
              <FormatOption 
                id="png" 
                label="PNG" 
                icon={<Image size={16} />} 
                selected={format === 'png'} 
                onClick={() => setFormat('png')} 
              />
              <FormatOption 
                id="jpeg" 
                label="JPEG" 
                icon={<Image size={16} />} 
                selected={format === 'jpeg'} 
                onClick={() => setFormat('jpeg')} 
              />
              <FormatOption 
                id="svg" 
                label="SVG" 
                icon={<Image size={16} />} 
                selected={format === 'svg'} 
                onClick={() => setFormat('svg')} 
              />
              <FormatOption 
                id="csv" 
                label="CSV" 
                icon={<FileText size={16} />} 
                selected={format === 'csv'} 
                onClick={() => setFormat('csv')} 
              />
            </div>
          </div>
          
          {/* Quality slider (for PNG and JPEG) */}
          {/* {(format === 'png' || format === 'jpeg') && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Quality: {Math.round(quality * 100)}%
              </label>
              <input
                type="range"
                min="0.5"
                max="1"
                step="0.01"
                value={quality}
                onChange={(e) => setQuality(parseFloat(e.target.value))}
                className="w-full cursor-pointer"
              />
            </div>
          )} */}
          
          {/* Options */}
          {format !== 'csv' && (
            <div>
              <label className="block text-sm font-medium mb-2">Options</label>
              <div className="space-y-2">
                <div className="flex items-center ">
                  <input
                    type="checkbox"
                    id="include-title"
                    checked={includeTitle}
                    onChange={(e) => setIncludeTitle(e.target.checked)}
                    className="mr-2 cursor-pointer" 
                  />
                  <label htmlFor="include-title" className="text-sm">Include title</label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="include-description"
                    checked={includeDescription}
                    onChange={(e) => setIncludeDescription(e.target.checked)}
                    className="mr-2 cursor-pointer"
                  />
                  <label htmlFor="include-description" className="text-sm">Include description</label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="include-background"
                    checked={includeBackground}
                    onChange={(e) => setIncludeBackground(e.target.checked)}
                    className="mr-2 cursor-pointer"
                  />
                  <label htmlFor="include-background" className="text-sm">Include background</label>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="mt-6 flex space-x-2">
          <Button
            variant="primary"
            className="flex-1"
            onClick={exportChart}
          >
            <Download size={16} className="mr-1" />
            Export {format.toUpperCase()}
          </Button>
          
          {format !== 'csv' && (
            <Button
              variant="ghost"
              onClick={copyToClipboard}
            >
              {copySuccess ? (
                <>
                  <Clipboard size={16} className="mr-1 text-primary" />
                  Copied!
                </>
              ) : (
                <>
                  <Clipboard size={16} className="mr-1" />
                  Copy
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Option button for format selection
 */
interface FormatOptionProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  selected: boolean;
  onClick: () => void;
}

const FormatOption: React.FC<FormatOptionProps> = ({ id, label, icon, selected, onClick }) => {
  return (
    <button
      className={`flex flex-col items-center justify-center p-2 cursor-pointer rounded ${
        selected 
          ? 'bg-primary/20 text-primary border border-primary/50' 
          : 'bg-background border border-border text-muted-foreground hover:text-foreground'
      }`}
      onClick={onClick}
      id={id}
    >
      {icon}
      <span className="text-xs mt-1">{label}</span>
    </button>
  );
};

/**
 * Create filter function for chart export
 */
function createFilter(includeTitle: boolean, includeDescription: boolean) {
  return (node: HTMLElement) => {
    // Skip title/description elements if not included
    if (!includeTitle && node.classList.contains('chart-title')) {
      return false;
    }
    if (!includeDescription && node.classList.contains('chart-description')) {
      return false;
    }
    return true;
  };
}

/**
 * Download a file from data URL
 */
function downloadFile(dataUrl: string, fileName: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Export data to CSV file
 */
function exportToCsv(data: any[], fileName: string) {
  if (!data || data.length === 0) return;
  
  // Get headers
  const headers = Object.keys(data[0]);
  
  // Create CSV content
  const csvRows = [
    headers.join(','), // Add header row
    ...data.map(row => 
      headers.map(header => {
        const val = row[header];
        // Handle null/undefined
        if (val === null || val === undefined) return '';
        // Wrap strings with commas in quotes
        if (typeof val === 'string' && val.includes(',')) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      }).join(',')
    )
  ];
  
  // Create blob and download
  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  downloadFile(url, `${fileName}.csv`);
  URL.revokeObjectURL(url);
}

export default ExportModal;