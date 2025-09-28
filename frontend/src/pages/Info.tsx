import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

import { SEO } from "@/components/common/SEO";

// Import version from package.json
import packageJson from "../../package.json";

const Info = () => {
  const navigate = useNavigate();

  const handleGoBack = () => {
    navigate('/');
  };

  return (
    <>
      <SEO
        title="Info - DataKit"
        description="Version information and application details for DataKit"
        keywords="datakit, version, info, about"
      />

      <div className="min-h-screen bg-background text-foreground">
        {/* Header */}
        <div className="border-b border-border px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={handleGoBack}
              className="text-muted-foreground hover:text-foreground transition-colors p-2 hover:bg-accent/5 rounded"
              title="Go Back"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold">App Information</h1>
              <p className="text-muted-foreground text-sm">Version and build details</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="container mx-auto px-6 py-12">
          <div className="max-w-2xl mx-auto">
            {/* Details */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="bg-popover border border-border rounded-xl p-6 mb-8"
            >
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-muted-foreground">Version</span>
                  <span className="font-mono text-primary">
                    {packageJson.version}
                  </span>
                </div>

                <div className="flex justify-between items-center py-2">
                  <span className="text-muted-foreground">Environment</span>
                  <span className="font-mono">{import.meta.env.MODE}</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Info;
