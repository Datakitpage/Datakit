import React, { useState, useRef } from 'react';
import { Download, X, Image, FileText, Clipboard } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toPng, toJpeg, toSvg } from 'html-to-image';

interface VisualizationExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  vizId: string;
  title?: string;
  data: any[];
}

const VisualizationExportModal: React.FC<VisualizationExportModalProps> = ({
  isOpen,
  onClose,
  vizId,
  title = 'Visualization',
  data
}) => {
  const [format, setFormat] = useState<'png' | 'jpeg' | 'svg' | 'csv'>('png');
  const [quality, setQuality] = useState<number>(0.92);
  const [includeTitle, setIncludeTitle] = useState<boolean>(true);
  const [includeBackground, setIncludeBackground] = useState<boolean>(true);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  
  if (!isOpen) return null;

  // Get reference to visualization chart element
  const getVisualizationElement = (): HTMLElement | null => {
    // Find the chart container specifically for this visualization
    const vizPanel = document.querySelector(`[data-viz-id="${vizId}"]`);
    if (!vizPanel) {
      console.warn('Visualization panel not found with ID:', vizId);
      // Try to find any visualization panel as fallback
      const anyVizPanel = document.querySelector('[data-viz-id]');
      if (anyVizPanel) {
        console.log('Using fallback visualization panel');
        return getChartFromPanel(anyVizPanel as HTMLElement);
      }
      return null;
    }
    
    return getChartFromPanel(vizPanel as HTMLElement);
  };

  const getChartFromPanel = (panel: HTMLElement): HTMLElement | null => {
    // First try to find the nivo-chart wrapper
    const nivoChart = panel.querySelector('.nivo-chart') as HTMLElement;
    if (nivoChart) {
      // Look for SVG inside the nivo-chart wrapper
      const svg = nivoChart.querySelector('svg') as HTMLElement;
      if (svg) {
        console.log('Found SVG inside nivo-chart:', svg);
        return svg;
      }
      console.log('Found nivo-chart container:', nivoChart);
      return nivoChart;
    }
    
    // Direct SVG lookup
    const svgElement = panel.querySelector('svg') as HTMLElement;
    if (svgElement) {
      console.log('Found direct SVG element:', svgElement);
      return svgElement;
    }
    
    // Look for any chart container with role="img" (Nivo sets this)
    const roleImg = panel.querySelector('[role="img"]') as HTMLElement;
    if (roleImg) {
      console.log('Found role="img" element:', roleImg);
      return roleImg;
    }
    
    // Last resort: look for any div with chart-like classes
    const chartDiv = panel.querySelector('div[class*="chart"], div[class*="nivo"]') as HTMLElement;
    if (chartDiv) {
      console.log('Found chart div:', chartDiv);
      return chartDiv;
    }
    
    console.warn('No chart element found in panel');
    return null;
  };

  // Export chart based on selected format
  const exportChart = async () => {
    const chartElement = getVisualizationElement();
    if (!chartElement) {
      console.error('Chart element not found for export');
      alert('Could not find chart element to export. Please try again.');
      return;
    }
    
    console.log('Exporting chart element:', chartElement);
    setIsExporting(true);
    
    try {
      let dataUrl;
      const bgColor = includeBackground ? '#1a1b26' : 'transparent';
      
      // Create file name
      const fileName = `${title.replace(/\s+/g, '_')}_${Date.now()}`;
      
      const exportOptions = {
        backgroundColor: bgColor,
        quality,
        filter: createFilter(includeTitle),
        pixelRatio: 2, // Higher quality
        cacheBust: true,
        style: {
          fontFamily: 'inherit',
        }
      };
      
      console.log('Export options:', exportOptions);
      
      switch (format) {
        case 'png':
          console.log('Exporting as PNG...');
          dataUrl = await toPng(chartElement, exportOptions);
          downloadFile(dataUrl, `${fileName}.png`);
          break;
          
        case 'jpeg':
          console.log('Exporting as JPEG...');
          dataUrl = await toJpeg(chartElement, exportOptions);
          downloadFile(dataUrl, `${fileName}.jpg`);
          break;
          
        case 'svg':
          console.log('Exporting as SVG...');
          dataUrl = await toSvg(chartElement, {
            backgroundColor: bgColor,
            filter: createFilter(includeTitle)
          });
          downloadFile(dataUrl, `${fileName}.svg`);
          break;
          
        case 'csv':
          console.log('Exporting as CSV...');
          exportToCsv(data, fileName);
          break;
      }
      
      console.log('Export completed successfully');
      // Close modal after successful export
      onClose();
    } catch (error) {
      console.error('Error exporting chart:', error);
      alert('Failed to export chart. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // Copy chart to clipboard
  const copyToClipboard = async () => {
    const chartElement = getVisualizationElement();
    if (!chartElement) {
      console.error('Chart element not found for clipboard copy');
      return;
    }
    
    setIsExporting(true);
    
    try {
      const dataUrl = await toPng(chartElement, { 
        backgroundColor: includeBackground ? '#1a1b26' : 'transparent',
        quality,
        filter: createFilter(includeTitle),
        pixelRatio: 2,
        cacheBust: true
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
      alert('Failed to copy chart to clipboard.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-background/60 flex items-center justify-center z-50">
      <div className="bg-background p-6 rounded-lg shadow-lg w-96 border border-border">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-foreground">Export Visualization</h3>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={onClose}
          >
            <X size={16} />
          </Button>
        </div>
        
        <div className="space-y-4">
          {/* Format selection */}
          <div>
            <label className="block text-sm font-medium mb-2 text-muted-foreground">Export Format</label>
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
          {(format === 'png' || format === 'jpeg') && (
            <div>
              <label className="block text-sm font-medium mb-2 text-muted-foreground">
                Quality: {Math.round(quality * 100)}%
              </label>
              <input
                type="range"
                min="0.5"
                max="1"
                step="0.01"
                value={quality}
                onChange={(e) => setQuality(parseFloat(e.target.value))}
                className="w-full cursor-pointer accent-primary"
              />
            </div>
          )}
          
          {/* Options */}
          {format !== 'csv' && (
            <div>
              <label className="block text-sm font-medium mb-2 text-muted-foreground">Options</label>
              <div className="space-y-2">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="include-title"
                    checked={includeTitle}
                    onChange={(e) => setIncludeTitle(e.target.checked)}
                    className="mr-2 cursor-pointer accent-primary" 
                  />
                  <label htmlFor="include-title" className="text-sm text-muted-foreground">Include title</label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="include-background"
                    checked={includeBackground}
                    onChange={(e) => setIncludeBackground(e.target.checked)}
                    className="mr-2 cursor-pointer accent-primary"
                  />
                  <label htmlFor="include-background" className="text-sm text-muted-foreground">Include background</label>
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
            disabled={isExporting}
          >
            <Download size={16} className="mr-1" />
            {isExporting ? 'Exporting...' : `Export ${format.toUpperCase()}`}
          </Button>
          
          {format !== 'csv' && (
            <Button
              variant="ghost"
              onClick={copyToClipboard}
              disabled={isExporting}
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
      className={`flex flex-col items-center justify-center p-2 cursor-pointer rounded transition-colors ${
        selected 
          ? 'bg-primary/20 text-primary border border-primary/50' 
          : 'bg-background border border-border text-muted-foreground hover:text-foreground hover:border-border'
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
function createFilter(includeTitle: boolean) {
  return (node: HTMLElement) => {
    // Skip title elements if not included
    if (!includeTitle && (
      node.classList.contains('chart-title') ||
      node.querySelector('.chart-title')
    )) {
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

export default VisualizationExportModal;