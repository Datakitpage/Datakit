import React from "react";
import { motion } from "framer-motion";
import {
  RefreshCw,
  Database,
  Search,
  BarChart3,
  TrendingUp,
} from "lucide-react";

/**
 * Analysis step configuration
 */
interface AnalysisStep {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  estimatedDuration: number; // seconds
  progressRange: [number, number]; // [start%, end%]
}

const ANALYSIS_STEPS: AnalysisStep[] = [
  {
    id: "validation",
    label: "Validating Data",
    description: "Checking table structure and accessibility",
    icon: <Database className="h-4 w-4" />,
    estimatedDuration: 1,
    progressRange: [0, 10],
  },
  {
    id: "schema",
    label: "Reading Schema",
    description: "Identifying column types and structure",
    icon: <Search className="h-4 w-4" />,
    estimatedDuration: 2,
    progressRange: [10, 25],
  },
  {
    id: "duplicates",
    label: "Detecting Duplicates",
    description: "Scanning for duplicate rows",
    icon: <RefreshCw className="h-4 w-4" />,
    estimatedDuration: 3,
    progressRange: [25, 35],
  },
  {
    id: "columns",
    label: "Analyzing Columns",
    description: "Computing statistics and patterns",
    icon: <BarChart3 className="h-4 w-4" />,
    estimatedDuration: 8,
    progressRange: [35, 85],
  },
  {
    id: "quality",
    label: "Quality Assessment",
    description: "Calculating health scores and recommendations",
    icon: <TrendingUp className="h-4 w-4" />,
    estimatedDuration: 2,
    progressRange: [85, 100],
  },
];

/**
 * Get current step based on progress percentage
 */
const getCurrentStep = (
  progress: number
): { current: AnalysisStep; next?: AnalysisStep } => {
  const currentStep =
    ANALYSIS_STEPS.find(
      (step) =>
        progress >= step.progressRange[0] && progress < step.progressRange[1]
    ) || ANALYSIS_STEPS[ANALYSIS_STEPS.length - 1];

  const currentIndex = ANALYSIS_STEPS.indexOf(currentStep);
  const nextStep = ANALYSIS_STEPS[currentIndex + 1];

  return { current: currentStep, next: nextStep };
};

/**
 * Enhanced loading component with step-by-step progress
 */
interface EnhancedLoadingStateProps {
  progress: number;
  status: string;
  startTime?: number;
  currentColumn?: string;
  totalColumns?: number;
  className?: string;
}

export const LoadingState: React.FC<EnhancedLoadingStateProps> = ({
  progress,

  currentColumn,
  totalColumns,
  className,
}) => {
  const { current: currentStep } = getCurrentStep(progress);

  return (
    <div className={`space-y-6 ${className || ""}`}>
      {/* Main progress circle */}
      <div className="flex flex-col items-center justify-center py-8">
        <div className="relative mb-6">
          {/* Background circle */}
          <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 80 80">
            <circle
              cx="40"
              cy="40"
              r="35"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="6"
              fill="none"
            />
            {/* Progress circle */}
            <motion.circle
              cx="40"
              cy="40"
              r="35"
              stroke="hsl(175, 100%, 36%)"
              strokeWidth="6"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 35}`}
              strokeDashoffset={`${2 * Math.PI * 35 * (1 - progress / 100)}`}
              initial={{ strokeDashoffset: 2 * Math.PI * 35 }}
              animate={{
                strokeDashoffset: 2 * Math.PI * 35 * (1 - progress / 100),
              }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
            />
          </svg>

          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xs font-mono text-foreground">
              {Math.round(progress)}%
            </span>
          </div>
        </div>

        {/* Current step info */}
        <motion.div
          key={currentStep.id}
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center space-y-2 max-w-sm"
        >
          <h3 className="text-sm font-semibold text-foreground">
            {currentStep.label}
          </h3>
          <p className="text-xs text-muted-foreground">{currentStep.description}</p>

          {/* Column progress for column analysis step */}
          {currentStep.id === "columns" && currentColumn && totalColumns && (
            <div className="text-xs text-muted-foreground">
              Analyzing: {currentColumn} • Column{" "}
              {Math.round(((progress - 35) / 50) * totalColumns)} of{" "}
              {totalColumns}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};
