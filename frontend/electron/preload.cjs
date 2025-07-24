const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  
  // File handling
  getOpenedFile: () => ipcRenderer.invoke('get-opened-file'),
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  
  // Event listeners for file opening
  onFileOpened: (callback) => {
    ipcRenderer.on('file-opened', (event, filePath) => callback(filePath));
  },
  removeAllFileOpenedListeners: () => {
    ipcRenderer.removeAllListeners('file-opened');
  },
  
  // Platform detection
  platform: process.platform,
  
  // Version info
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  }
});