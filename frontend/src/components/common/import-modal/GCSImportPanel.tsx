import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Cloud,
  Search,
  Download,
  ExternalLink,
  Calendar,
  Globe,
  Satellite,
  Eye,
  ArrowRight,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import useGCSImport from "@/hooks/remote/gcs/useGCSImport";
import usePublicDatasets from "@/hooks/remote/usePublicDatasets";

interface GCSImportPanelProps {
  onImport: (result: any) => void;
}

const GCS_CATEGORIES = [
  { id: "all", name: "All Datasets", icon: <Cloud className="h-4 w-4" /> },
  {
    id: "earth-observation",
    name: "Earth Observation",
    icon: <Satellite className="h-4 w-4" />,
  },
  { id: "climate", name: "Climate Data", icon: <Globe className="h-4 w-4" /> },
  {
    id: "geospatial",
    name: "Geospatial",
    icon: <MapPin className="h-4 w-4" />,
  },
  { id: "research", name: "Research", icon: <Search className="h-4 w-4" /> },
];

const GCS_FEATURED_DATASETS = [
  {
    id: "landsat-8",
    name: "Landsat 8 Satellite Imagery",
    description:
      "Global satellite imagery from Landsat 8, providing multispectral Earth observation data at 30m resolution.",
    category: "earth-observation",
    format: ["GeoTIFF", "MTL"],
    size: "500+ TB",
    lastUpdated: "2024-12-20",
    gcsUrl: "gs://gcp-public-data-landsat/LC08",
    documentation:
      "https://cloud.google.com/storage/docs/public-datasets/landsat",
    tags: ["satellite", "landsat", "earth-observation", "multispectral"],
    featured: true,
    provider: "gcp" as const,
  },
  {
    id: "sentinel-2",
    name: "Sentinel-2 Satellite Data",
    description:
      "European Space Agency Sentinel-2 satellite imagery providing high-resolution optical observations.",
    category: "earth-observation",
    format: ["JPEG2000", "GeoTIFF"],
    size: "1+ PB",
    lastUpdated: "2024-12-20",
    gcsUrl: "gs://gcp-public-data-sentinel-2",
    documentation:
      "https://cloud.google.com/storage/docs/public-datasets/sentinel-2",
    tags: ["satellite", "sentinel", "esa", "optical"],
    featured: true,
    provider: "gcp" as const,
  },
  {
    id: "modis-terra",
    name: "MODIS Terra Satellite Data",
    description:
      "Moderate Resolution Imaging Spectroradiometer data from Terra satellite for climate and environmental research.",
    category: "climate",
    format: ["HDF", "NetCDF"],
    size: "200+ TB",
    lastUpdated: "2024-12-15",
    gcsUrl: "gs://gcp-public-data-modis",
    documentation: "https://modis.gsfc.nasa.gov/",
    tags: ["modis", "climate", "terra", "environmental"],
    featured: true,
    provider: "gcp" as const,
  },
  {
    id: "noaa-goes",
    name: "NOAA GOES Weather Satellite",
    description:
      "Geostationary weather satellite data providing real-time weather monitoring and forecasting.",
    category: "climate",
    format: ["NetCDF", "Binary"],
    size: "100+ TB",
    lastUpdated: "2024-12-20",
    gcsUrl: "gs://gcp-public-data-goes-16",
    documentation: "https://www.goes-r.gov/",
    tags: ["weather", "goes", "noaa", "geostationary"],
    featured: false,
    provider: "gcp" as const,
  },
  {
    id: "open-buildings",
    name: "Google Open Buildings",
    description:
      "Computer-generated building footprints for various regions across the globe.",
    category: "geospatial",
    format: ["CSV", "GeoJSON"],
    size: "50+ GB",
    lastUpdated: "2024-10-01",
    gcsUrl: "gs://open-buildings-data",
    documentation: "https://sites.research.google/open-buildings/",
    tags: ["buildings", "geospatial", "ml", "footprints"],
    featured: false,
    provider: "gcp" as const,
  },
];

const DatasetCard: React.FC<{
  dataset: any;
  onPreview: (dataset: any) => void;
  onImport: (dataset: any) => void;
  isImporting: boolean;
}> = ({ dataset, onPreview, onImport, isImporting }) => {
  const formatsList =
    dataset.format.slice(0, 2).join(", ") +
    (dataset.format.length > 2 ? ` +${dataset.format.length - 2}` : "");

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-accent/5 border border-border rounded-lg p-4 hover:bg-accent/10 hover:border-border transition-all duration-200"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center mb-1">
            <h4 className="text-sm font-medium text-foreground truncate mr-2">
              {dataset.name}
            </h4>
            {dataset.featured && (
              <span className="bg-blue-500/20 text-blue-500 text-xs px-1.5 py-0.5 rounded">
                Featured
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
            {dataset.description}
          </p>
        </div>
      </div>

      <div className="flex items-center text-xs text-muted-foreground space-x-4 mb-3">
        <span className="flex items-center">
          <Cloud className="h-3 w-3 mr-1" />
          {dataset.size}
        </span>
        <span className="flex items-center">
          <Calendar className="h-3 w-3 mr-1" />
          {new Date(dataset.lastUpdated).toLocaleDateString()}
        </span>
        <span className="bg-blue-500/20 text-blue-500 px-1.5 py-0.5 rounded text-[10px]">
          {formatsList}
        </span>
      </div>

      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPreview(dataset)}
          className="flex-1 text-xs border-white/20 hover:border-white/30"
        >
          <Eye className="h-3 w-3 mr-1" />
          Preview
        </Button>
        <Button
          size="sm"
          onClick={() => onImport(dataset)}
          disabled={isImporting}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-xs"
        >
          {isImporting ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="h-3 w-3 border border-white border-t-transparent rounded-full mr-1"
              />
              Importing
            </>
          ) : (
            <>
              <Download className="h-3 w-3 mr-1" />
              Import
            </>
          )}
        </Button>
      </div>

      {dataset.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {dataset.tags.slice(0, 3).map((tag: string) => (
            <span
              key={tag}
              className="bg-accent/10 text-muted-foreground text-[10px] px-1.5 py-0.5 rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
};

const DatasetPreviewModal: React.FC<{
  dataset: any;
  isOpen: boolean;
  onClose: () => void;
  onImport: (dataset: any) => void;
  isImporting: boolean;
}> = ({ dataset, isOpen, onClose, onImport, isImporting }) => {
  if (!dataset) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-background/60"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-popover border border-border rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-medium text-foreground mb-1">
                    {dataset.name}
                  </h3>
                  <p className="text-muted-foreground text-sm">{dataset.description}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ×
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-accent/5 p-3 rounded">
                  <div className="text-xs text-muted-foreground mb-1">Category</div>
                  <div className="text-sm text-foreground capitalize">
                    {dataset.category}
                  </div>
                </div>
                <div className="bg-accent/5 p-3 rounded">
                  <div className="text-xs text-muted-foreground mb-1">Size</div>
                  <div className="text-sm text-foreground">{dataset.size}</div>
                </div>
                <div className="bg-accent/5 p-3 rounded">
                  <div className="text-xs text-muted-foreground mb-1">Formats</div>
                  <div className="text-sm text-foreground">
                    {dataset.format.join(", ")}
                  </div>
                </div>
                <div className="bg-accent/5 p-3 rounded">
                  <div className="text-xs text-muted-foreground mb-1">Last Updated</div>
                  <div className="text-sm text-foreground">
                    {new Date(dataset.lastUpdated).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {dataset.tags.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs text-muted-foreground mb-2">Tags</div>
                  <div className="flex flex-wrap gap-1">
                    {dataset.tags.map((tag: string) => (
                      <span
                        key={tag}
                        className="bg-accent/10 text-foreground/80 text-xs px-2 py-1 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-6">
                <div className="text-xs text-white/60 mb-2">GCS URL</div>
                <div className="bg-background p-2 rounded text-xs text-foreground/80 font-mono break-all">
                  {dataset.gcsUrl}
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Button variant="outline" onClick={onClose} className="flex-1">
                  Cancel
                </Button>
                {dataset.documentation && (
                  <Button
                    variant="outline"
                    onClick={() => window.open(dataset.documentation, "_blank")}
                    className="border-blue-500/30 text-blue-400 hover:border-blue-500/50"
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Docs
                  </Button>
                )}
                <Button
                  onClick={() => onImport(dataset)}
                  disabled={isImporting}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {isImporting ? "Importing" : "Import Dataset"}
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const GCSImportPanel: React.FC<GCSImportPanelProps> = ({ onImport }) => {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [previewDataset, setPreviewDataset] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);

  const {
    importFromGCS,
    isImporting,
    importStatus,
    importProgress,
    error: importError,
  } = useGCSImport();

  // Use static datasets for now (in production, this would fetch from GCP registry)
  const datasets = GCS_FEATURED_DATASETS;
  const datasetsLoading = false;
  const datasetsError = null;

  const filteredDatasets = datasets.filter((dataset) => {
    const matchesCategory =
      selectedCategory === "all" || dataset.category === selectedCategory;
    const matchesSearch =
      dataset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dataset.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dataset.tags.some((tag) =>
        tag.toLowerCase().includes(searchQuery.toLowerCase())
      );
    return matchesCategory && matchesSearch;
  });

  const featuredDatasets = filteredDatasets.filter((d) => d.featured);
  const regularDatasets = filteredDatasets.filter((d) => !d.featured);

  const handlePreview = (dataset: any) => {
    setPreviewDataset(dataset);
    setShowPreview(true);
  };

  const handleImport = async (dataset: any) => {
    try {
      const result = await importFromGCS(dataset.gcsUrl, dataset.name);

      const enhancedResult = {
        ...result,
        isRemote: true,
        remoteProvider: "gcs",
        remoteURL: dataset.gcsUrl,
        gcs: {
          bucket: dataset.gcsUrl.split("/")[2],
          object: dataset.gcsUrl.split("/").slice(3).join("/"),
          dataset: {
            id: dataset.id,
            name: dataset.name,
            category: dataset.category,
          },
        },
      };

      onImport(enhancedResult);
      setShowPreview(false);
    } catch (error) {
      console.error("Failed to import GCS dataset:", error);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center mb-3">
          <div className="h-10 w-10 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center mr-3">
            <Cloud className="h-6 w-6 text-blue-500" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-foreground">
              Google Cloud Storage
            </h3>
            <p className="text-sm text-muted-foreground">
              Access public datasets and earth observation data
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search datasets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-popover border border-border rounded-lg text-foreground/90 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/50 placeholder:text-muted-foreground"
          />
        </div>

        {/* Category Filter */}
        <div className="flex gap-1 overflow-x-auto">
          {GCS_CATEGORIES.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={cn(
                "flex items-center px-3 py-1.5 rounded text-xs whitespace-nowrap transition-all",
                selectedCategory === category.id
                  ? "bg-blue-500/20 text-blue-500 border border-blue-500/30"
                  : "bg-accent/5 text-muted-foreground hover:bg-accent/10 border border-border"
              )}
            >
              {category.icon}
              <span className="ml-1.5">{category.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {datasetsLoading ? (
          <div className="flex items-center justify-center h-32">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full"
            />
            <span className="ml-2 text-white/60">Loading datasets...</span>
          </div>
        ) : datasetsError ? (
          <div className="p-4 text-center">
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <div className="text-red-400 text-sm">{datasetsError}</div>
            </div>
          </div>
        ) : (
          <div className="p-4">
            {/* Featured Datasets */}
            {featuredDatasets.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-white/80 mb-3 flex items-center">
                  <Satellite className="h-4 w-4 mr-1.5 text-blue-500" />
                  Featured Earth Observation
                </h4>
                <div className="grid gap-3">
                  {featuredDatasets.map((dataset) => (
                    <DatasetCard
                      key={dataset.id}
                      dataset={dataset}
                      onPreview={handlePreview}
                      onImport={handleImport}
                      isImporting={isImporting}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Regular Datasets */}
            {regularDatasets.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-white/80 mb-3 flex items-center">
                  <Cloud className="h-4 w-4 mr-1.5 text-white/60" />
                  All Datasets ({regularDatasets.length})
                </h4>
                <div className="grid gap-3">
                  {regularDatasets.map((dataset) => (
                    <DatasetCard
                      key={dataset.id}
                      dataset={dataset}
                      onPreview={handlePreview}
                      onImport={handleImport}
                      isImporting={isImporting}
                    />
                  ))}
                </div>
              </div>
            )}

            {filteredDatasets.length === 0 && !datasetsLoading && (
              <div className="text-center py-8">
                <Cloud className="h-12 w-12 text-white/20 mx-auto mb-3" />
                <p className="text-white/60">No datasets found</p>
                <p className="text-white/40 text-sm">
                  Try adjusting your search or category filter
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Import Progress */}
      <AnimatePresence>
        {isImporting && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-white/10 p-4 bg-blue-500/5"
          >
            <div className="flex items-center text-sm">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full mr-2"
              />
              <span className="text-white/90">{importStatus}</span>
            </div>
            {importProgress > 0 && (
              <div className="w-full bg-black/30 h-1.5 mt-2 rounded-full overflow-hidden">
                <motion.div
                  className="bg-blue-500 h-full rounded-full"
                  initial={{ width: "0%" }}
                  animate={{ width: `${Math.max(5, importProgress * 100)}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview Modal */}
      <DatasetPreviewModal
        dataset={previewDataset}
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        onImport={handleImport}
        isImporting={isImporting}
      />
    </div>
  );
};

export default GCSImportPanel;
