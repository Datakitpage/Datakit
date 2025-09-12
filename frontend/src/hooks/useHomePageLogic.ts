import { useAnalytics } from './useAnalytics'
import useDirectFileImport from './useDirectFileImport'
import { useAppStore } from '@/store/appStore'
import {
  selectActiveFileInfo,
  selectStatusText,
  selectFileName,
  selectSourceType,
  selectJsonSchema,
} from '@/store/selectors/appSelectors'
import { DataSourceType } from '@/types/json'
import { DataLoadWithDuckDBResult } from '@/types/multiFile'
import { useDemoFileDrops } from './useDemoFileDrops'
import { useUrlParameterHandler } from './useUrlParameterHandler'
import { useTabTracking } from './useTabTracking'
import { useIframeDetection } from './useIframeDetection'
import { useSharedFileImport } from './useSharedFileImport'

export const useHomePageLogic = () => {
  const analytics = useAnalytics()
  const { processFile } = useDirectFileImport()

  // Use selectors for reactive data access
  const activeFileInfo = useAppStore(selectActiveFileInfo)
  const statusText = useAppStore(selectStatusText)
  const fileName = useAppStore(selectFileName)
  const sourceType = useAppStore(selectSourceType)
  const jsonSchema = useAppStore(selectJsonSchema)

  // Get UI state and actions
  const { activeTab, jsonViewMode, setActiveTab, setJsonViewMode, addFile, isInIframe } = useAppStore()

  // Custom hooks for specific functionality
  useIframeDetection() // Initialize iframe detection
  useTabTracking(activeTab)
  useDemoFileDrops({ processFile, addFile, analytics })
  useUrlParameterHandler({ processFile, addFile, analytics })
  useSharedFileImport() // Handle shared file imports from SharePreview

  /**
   * Handle data load from sidebar
   * @param result - Parsed data result including DuckDB information
   */
  const handleDataLoad = (result: DataLoadWithDuckDBResult) => {
    addFile(result)
    analytics.trackFileUpload(result)
  }

  // Prepare feedback context
  const feedbackContext = fileName
    ? `Feedback provided while working with: ${fileName} (${
        sourceType === DataSourceType.JSON ? 'JSON' : 'CSV'
      }, ${activeFileInfo?.rowCount || 0} rows)`
    : undefined

  return {
    // Store data
    activeFileInfo,
    statusText,
    fileName,
    sourceType,
    jsonSchema,
    activeTab,
    jsonViewMode,
    isInIframe,
    
    // Store actions
    setActiveTab,
    setJsonViewMode,
    
    // Computed values
    feedbackContext,
    
    // Handlers
    handleDataLoad,
  }
}