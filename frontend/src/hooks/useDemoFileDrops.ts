import { useEffect } from 'react'
import { useAnalytics } from './useAnalytics'
import useDirectFileImport from './useDirectFileImport'
import { useAppStore } from '@/store/appStore'

interface UseDemoFileDropsProps {
  processFile: ReturnType<typeof useDirectFileImport>['processFile']
  addFile: ReturnType<typeof useAppStore>['addFile']
  analytics: ReturnType<typeof useAnalytics>
}

export const useDemoFileDrops = ({ processFile, addFile, analytics }: UseDemoFileDropsProps) => {
  useEffect(() => {
    const handleDemoFileDrops = (event: MessageEvent) => {
      console.log('Home.tsx received message:', event.data, 'from origin:', event.origin)

      // Security: only accept from your demo domains
      const allowedOrigins = [
        'https://datakit.studio',
        'http://localhost:5174',
        'http://localhost:5173'
      ]

      const isOriginAllowed = allowedOrigins.some(origin => {
        if (origin.includes('*')) {
          const baseOrigin = origin.replace('*', '')
          return event.origin.endsWith(baseOrigin)
        }
        return event.origin === origin
      })

      if (!isOriginAllowed) {
        console.log('Origin not allowed:', event.origin)
        return
      }

      // Handle handshake from parent iframe
      if (event.data.type === 'DEMO_READY') {
        console.log('Received DEMO_READY, sending confirmation back')
        event.source?.postMessage({
          type: 'DATAKIT_READY',
          message: 'DataKit ready to receive files'
        }, event.origin as WindowPostMessageOptions)
        return
      }

      if (event.data.type === 'FILE_DROP') {
        console.log('Processing FILE_DROP message:', event.data)
        const { file } = event.data

        // Convert base64 data back to File object
        const binaryString = atob(file.data)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }

        const recreatedFile = new File([bytes], file.name, { type: file.type })

        // Use existing file processing logic
        processFile(recreatedFile, (result) => {
          addFile(result)
          analytics.trackFileUpload(result)
        })

        // Send success confirmation back to demo
        event.source?.postMessage({
          type: 'FILE_PROCESSED',
          fileName: file.name,
          success: true
        }, event.origin)
      }
    }

    window.addEventListener('message', handleDemoFileDrops)
    return () => window.removeEventListener('message', handleDemoFileDrops)
  }, [processFile, addFile, analytics])
}