import { useEffect, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useUrlDatasetImport } from "@/hooks/remote/url/useUrlDatasetImport";
import { extractImportOptionsFromUrl } from "@/utils/datasetUrlHandler";
import HuggingFace from "@/assets/huggingface.png";

/**
 * Component for handling URL-based dataset imports
 * Supports URLs like: /datasets/HuggingFaceFW/fineweb-2
 */
const DatasetImport = () => {
  const { organization, dataset } = useParams<{
    organization: string;
    dataset: string;
  }>();
  const [searchParams] = useSearchParams();
  const { importFromUrlParamsWithNavigation } = useUrlDatasetImport();
  const hasImported = useRef(false);

  useEffect(() => {
    const handleDatasetImport = async () => {
      if (!organization || !dataset || hasImported.current) {
        return;
      }

      hasImported.current = true;

      try {
        const importOptions = extractImportOptionsFromUrl(
          organization,
          dataset,
          searchParams
        );
        
        await importFromUrlParamsWithNavigation({
          organization: importOptions.organization,
          dataset: importOptions.dataset,
          provider: importOptions.provider,
          config: importOptions.config,
          split: importOptions.split,
          authToken: importOptions.authToken
        });
      } catch (error) {
        // Error handling is managed in the hook
        console.error("Dataset import failed:", error);
      }
    };

    handleDatasetImport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization, dataset]);

  // Show a minimal loading state while processing
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center">
        <div className="flex items-center justify-center mb-4">
          <img src={HuggingFace} alt="HuggingFace" className="w-12 h-12 animate-pulse" />
        </div>
        <h2 className="text-xl font-medium text-foreground mb-2">
          Importing Dataset
        </h2>
        <p className="text-muted-foreground">
          Processing {organization}/{dataset}...
        </p>
      </div>
    </div>
  );
};

export default DatasetImport;