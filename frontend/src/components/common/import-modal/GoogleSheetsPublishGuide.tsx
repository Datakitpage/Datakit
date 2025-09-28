import React from 'react';
import { FileSpreadsheet, ExternalLink, AlertCircle, Share2, ChevronRight } from 'lucide-react';
import GoogleSheetsIcon from '@/components/icons/GoogleSheetsIcon';
import { motion } from 'framer-motion';

interface GoogleSheetsPublishGuideProps {
  className?: string;
  compact?: boolean;
}

const GoogleSheetsPublishGuide: React.FC<GoogleSheetsPublishGuideProps> = ({
  className = '',
  compact = false,
}) => {
  if (compact) {
    return (
      <div className={`bg-accent/5 p-3 rounded border border-border text-xs ${className}`}>
        <h4 className="text-foreground/90 font-medium flex items-center mb-2">
          <GoogleSheetsIcon className="h-3.5 w-3.5 mr-1.5 text-green-500" />
          <span>How to publish your sheet:</span>
        </h4>
        
        <div className="flex items-center space-x-2 text-muted-foreground bg-background/20 p-1.5 rounded">
          <span className="bg-green-500/20 text-green-500 px-1.5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium">1</span>
          <span className="flex-1">File → Share → Publish to web</span>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        
        <div className="mt-2">
          <a 
            href="https://support.google.com/docs/answer/183965" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-primary flex items-center hover:underline"
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Google's guide to publishing
          </a>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`bg-gradient-to-b from-accent/5 to-accent/[0.02] p-4 rounded-lg border border-border ${className}`}
    >
      <h3 className="text-foreground font-medium flex items-center text-sm mb-2">
        <GoogleSheetsIcon className="h-4 w-4 mr-2 text-green-500" />
        How to Publish Your Google Sheet
      </h3>
      
      <div className="space-y-3 mt-3">
        <div className="flex items-start">
          <div className="bg-green-500/20 text-green-500 h-5 w-5 rounded-full flex items-center justify-center mr-3 flex-shrink-0 text-xs font-medium">1</div>
          <div className="bg-background/20 rounded p-2 flex-1 border border-border">
            <p className="text-foreground/90 text-sm">Open your Google Sheet in your browser</p>
          </div>
        </div>
        
        <div className="flex items-start">
          <div className="bg-green-500/20 text-green-500 h-5 w-5 rounded-full flex items-center justify-center mr-3 flex-shrink-0 text-xs font-medium">2</div>
          <div className="bg-background/20 rounded p-2 flex-1 border border-border">
            <p className="text-white/90 text-sm flex items-center">
              <Share2 className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <span>Click <strong>File</strong> → <strong>Share</strong> → <strong>Publish to web</strong></span>
            </p>
          </div>
        </div>
        
        <div className="flex items-start">
          <div className="bg-green-500/20 text-green-500 h-5 w-5 rounded-full flex items-center justify-center mr-3 flex-shrink-0 text-xs font-medium">3</div>
          <div className="bg-background/20 rounded p-2 flex-1 border border-border">
            <p className="text-foreground/90 text-sm">Under <strong>"Link"</strong> tab, select:</p>
            <div className="mt-1 pl-2 space-y-1">
              <p className="text-muted-foreground text-xs flex items-center">
                <span className="h-1.5 w-1.5 bg-muted-foreground rounded-full mr-1.5"></span>
                Entire Document (or specific sheet)
              </p>
              <p className="text-muted-foreground text-xs flex items-center">
                <span className="h-1.5 w-1.5 bg-muted-foreground rounded-full mr-1.5"></span>
                CSV (.csv), or Excel (.xlsx)
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-start">
          <div className="bg-green-500/20 text-green-500 h-5 w-5 rounded-full flex items-center justify-center mr-3 flex-shrink-0 text-xs font-medium">4</div>
          <div className="bg-background/20 rounded p-2 flex-1 border border-border">
            <p className="text-foreground/90 text-sm">Click <strong>"Publish"</strong> and then <strong>"Copy link"</strong></p>
            <p className="mt-1 text-muted-foreground text-xs">You can paste this link directly into DataKit</p>
          </div>
        </div>
      </div>
      
      <div className="mt-4 bg-amber-500/10 p-3 rounded border border-amber-500/20 flex items-start">
        <AlertCircle className="text-amber-400 h-4 w-4 mr-2 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          <span className="text-amber-400 font-medium">Important:</span> Publishing makes your sheet publicly accessible. Do not publish sheets containing sensitive or private data.
        </p>
      </div>
      
      <a 
        href="https://support.google.com/docs/answer/183965" 
        target="_blank" 
        rel="noopener noreferrer"
        className="mt-3 text-xs text-primary flex items-center hover:underline"
      >
        <ExternalLink className="h-3 w-3 mr-1" />
        Google's official guide to publishing
      </a>
    </motion.div>
  );
};

export default GoogleSheetsPublishGuide;