import { motion } from "framer-motion";
import { Container, Terminal, Code, Hexagon, Upload, PlayCircle } from "lucide-react";
import { useState } from "react";

import S3 from "@/assets/s3.png";
import HuggingFace from "@/assets/huggingface.png";
import GoogleSheetsIcon from "@/components/icons/GoogleSheetsIcon";
import postgresIcon from "@/assets/postgres.png";

import { ImportProvider } from "@/types/remoteImport";
import { useFileUpload } from "@/components/data-grid/hooks";
import DemoVideoModal from "@/components/data-grid/DemoVideoModal";

interface RemoteImportOption {
  id: ImportProvider;
  name: string;
  icon: React.ReactNode;
  description: string;
}

interface Props {
  onImportOptionClick: (string: ImportProvider) => void;
}

const EmptyDataState: React.FC<Props> = ({ onImportOptionClick }) => {
  const { fileInputRef, handleButtonClick, handleFileSelect, isProcessing } = useFileUpload();
  const [showDemoModal, setShowDemoModal] = useState(false);

  const remoteOptions: RemoteImportOption[] = [
    {
      id: "postgresql",
      name: "PostgreSQL",
      icon: <img src={postgresIcon} className="h-5 w-5" />,
      description: "Postgres Databases",
    },
    {
      id: "s3",
      name: "Amazon S3",
      icon: <img src={S3} className="h-4 w-4" />,
      description: "Public S3 buckets",
    },
    {
      id: "huggingface",
      name: "HuggingFace",
      icon: <img src={HuggingFace} className="h-5 w-5" />,
      description: "ML datasets",
    },
    {
      id: "google-sheets",
      name: "Google Sheets",
      icon: <GoogleSheetsIcon className="h-5 w-5" />,
      description: "Published sheets",
    },
  ];

  const installOptions = [
    {
      name: "Docker",
      icon: Container,
      emoji: "🐳",
      url: "https://docs.datakit.page/docs/installation/docker",
    },
    {
      name: "Homebrew",
      icon: Terminal,
      emoji: "🍺",
      url: "https://docs.datakit.page/docs/installation/brew",
    },
    {
      name: "Python",
      icon: Code,
      emoji: "🐍",
      url: "https://docs.datakit.page/docs/installation/pip",
    },
    {
      name: "Node.js",
      icon: Hexagon,
      emoji: "⬢",
      url: "https://docs.datakit.page/docs/installation/npm",
    },
  ];


  return (
    <div className="h-full flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center max-w-2xl"
      >
        {/* Main heading with demo button */}
        <div className="flex items-center justify-center gap-3 mb-3 flex-wrap">
          <h1 className="text-2xl font-heading font-semibold text-white">
            Get started with DataKit
          </h1>
          <span className="text-white/40 text-sm">or</span>
          <motion.button
            onClick={() => setShowDemoModal(true)}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ 
              opacity: 1, 
              scale: 1,
              boxShadow: "0 0 20px rgba(139, 92, 246, 0.35)"
            }}
            transition={{ delay: 0.2, duration: 0.3 }}
            whileHover={{ 
              scale: 1.05,
              boxShadow: "0 0 25px rgba(139, 92, 246, 0.4)"
            }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-white hover:text-white transition-all duration-300 group border border-white/20 hover:border-white/40"
          >
            <motion.div
              whileHover={{ scale: 1.1 }}
              transition={{ duration: 0.2 }}
            >
              <PlayCircle className="h-4 w-4" />
            </motion.div>
            <span>watch a demo</span>
          </motion.button>
        </div>

        {/* Description */}
        <p className="text-white/70 mb-6 leading-relaxed">
          <motion.span
            className="relative overflow-hidden"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.3 }}
          >
            <motion.span
              className="bg-gradient-to-r from-primary via-blue-500 to-primary bg-clip-text text-transparent bg-[length:200%_100%]"
              animate={{
                backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "linear",
              }}
            >
             Everything runs locally by default
            </motion.span>
          </motion.span>
          {" "}— your data never leaves your machine.
          <br />
          <span className="text-white/50">
            When you're ready, save projects securely.
          </span>
        </p>

        {/* Import options */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-8"
        >
          <div className="flex items-center justify-center gap-4 flex-wrap">
            {/* Local file upload button with text */}
            <div className="flex items-center gap-2">
              <motion.button
                onClick={handleButtonClick}
                disabled={isProcessing}
                whileHover={{ scale: 1.10 }}
                whileTap={{ scale: 0.95 }}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, duration: 0.3 }}
                className="group relative w-9 h-9 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 hover:border-white/30 flex items-center justify-center transition-all duration-200 cursor-pointer"
                type="button"
              >
                <Upload className="h-4 w-4 text-white/70" />
                
                {/* Tooltip */}
                <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-black/90 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                  <div className="font-medium">Open File</div>
                  <div className="text-white/70">Local files</div>
                  {/* Tooltip arrow */}
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-black/90"></div>
                </div>
              </motion.button>
              
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4, duration: 0.3 }}
                className="text-primary text-sm font-medium"
              >
                Open file
              </motion.span>
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".csv,.json,.xlsx,.xls,.parquet,.duckdb"
              onChange={handleFileSelect}
              disabled={isProcessing}
            />

            {/* Divider */}
            <span className="text-white/50 text-sm">or</span>

            {/* Remote options label */}
            <span className="text-white/70 text-sm">import from:</span>

            {/* Grouped remote options */}
            <div className="inline-flex items-center bg-white/5 border border-white/10 rounded-full p-1.5 gap-1">
              {remoteOptions.map((option, index) => {
                return (
                  <motion.button
                    key={option.id}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onImportOptionClick(option.id);
                    }}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 + index * 0.1, duration: 0.3 }}
                    className="group relative w-9 h-9 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 hover:border-white/30 flex items-center justify-center transition-all duration-200 hover:scale-110 cursor-pointer"
                    type="button"
                  >
                    <div className="pointer-events-none">{option.icon}</div>

                    {/* Tooltip */}
                    <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-black/90 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                      <div className="font-medium">{option.name}</div>
                      <div className="text-white/70">{option.description}</div>
                      {/* Tooltip arrow */}
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-black/90"></div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* Self-hosting section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="border-t border-white/10 pt-6"
        >
          <p className="text-white/50 text-sm mb-4">Self-host DataKit:</p>

          <div className="flex items-center justify-center gap-3">
            {installOptions.map((option, index) => {
              const IconComponent = option.icon;

              return (
                <motion.a
                  key={option.name}
                  href={option.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + index * 0.1, duration: 0.4 }}
                  className="group relative w-10 h-10 rounded-full bg-white/5 hover:bg-primary/10 border border-white/10 hover:border-primary/30 flex items-center justify-center transition-all duration-200 hover:scale-105"
                >
                  {/* Fallback to emoji on small screens or if icon fails */}
                  <span className="text-lg sm:hidden">{option.emoji}</span>
                  <IconComponent className="h-4 w-4 text-primary hidden sm:block" />
                  {/* Tooltip */}
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
                    {option.name}
                  </div>
                </motion.a>
              );
            })}
          </div>
        </motion.div>
      </motion.div>
      
      {/* Demo Video Modal */}
      <DemoVideoModal
        isOpen={showDemoModal}
        onClose={() => setShowDemoModal(false)}
        videoUrl="/video/datakit-demo.mp4"
        title="Take a look at your DataKit"
      />
    </div>
  );
};

export default EmptyDataState;
