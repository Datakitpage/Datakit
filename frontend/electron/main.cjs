const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = process.env.NODE_ENV === 'development';

// Store the file that was opened to pass to the renderer
let fileToOpen = null;

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: false, // Disabled to allow WASM and local file access
      allowRunningInsecureContent: false,
      allowDisplayingInsecureContent: false,
      preload: path.join(__dirname, 'preload.cjs')
    },
    icon: path.join(__dirname, '../public/datakit.png'),
    titleBarStyle: 'default',
    show: false
  });

  // Load the app
  if (isDev) {
    console.log('Loading development URL: http://localhost:5173');
    mainWindow.loadURL('http://localhost:5173').catch(err => {
      console.error('Failed to load URL:', err);
    });
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    const indexPath = path.join(__dirname, '../dist/index.html');
    console.log('Loading production file:', indexPath);
    
    // Check if file exists
    if (fs.existsSync(indexPath)) {
      console.log('Index file exists, loading...');
    } else {
      console.error('Index file does not exist at:', indexPath);
    }
    
    mainWindow.loadFile(indexPath).catch(err => {
      console.error('Failed to load production file:', err);
    });
  }

  // Add error handling
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('Failed to load:', errorCode, errorDescription, validatedURL);
  });

  mainWindow.webContents.on('dom-ready', () => {
    console.log('DOM is ready');
  });

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Security: Prevent new window creation
  mainWindow.webContents.on('new-window', (event, url) => {
    event.preventDefault();
    shell.openExternal(url);
  });

  return mainWindow;
}

// Handle file opening before the app is ready (for cold starts)
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, focus our window instead
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      const mainWindow = windows[0];
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      
      // Handle file opening from command line
      const filePath = commandLine.find(arg => 
        arg.endsWith('.csv') || arg.endsWith('.json') || 
        arg.endsWith('.xlsx') || arg.endsWith('.xls') || 
        arg.endsWith('.parquet')
      );
      
      if (filePath) {
        fileToOpen = filePath;
        mainWindow.webContents.send('file-opened', filePath);
      }
    }
  });

  // This method will be called when Electron has finished initialization
  app.whenReady().then(() => {
    // Check for file in command line arguments (Windows/Linux)
    const filePath = process.argv.find(arg => 
      arg.endsWith('.csv') || arg.endsWith('.json') || 
      arg.endsWith('.xlsx') || arg.endsWith('.xls') || 
      arg.endsWith('.parquet')
    );
    
    if (filePath) {
      fileToOpen = filePath;
    }
    
    createWindow();

    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

// macOS file opening support
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  fileToOpen = filePath;
  
  const windows = BrowserWindow.getAllWindows();
  if (windows.length > 0) {
    // App is already running, send file to renderer
    windows[0].webContents.send('file-opened', filePath);
  }
  // If no windows, the file will be handled when the window is created
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Security: Prevent navigation to external websites
app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    
    if (parsedUrl.origin !== 'http://localhost:5173' && parsedUrl.origin !== 'file://') {
      event.preventDefault();
    }
  });
});

// IPC handlers for file operations
ipcMain.handle('show-save-dialog', async (event, options) => {
  const result = await dialog.showSaveDialog(options);
  return result;
});

ipcMain.handle('show-open-dialog', async (event, options) => {
  const result = await dialog.showOpenDialog(options);
  return result;
});

// Handle getting the opened file
ipcMain.handle('get-opened-file', async () => {
  const file = fileToOpen;
  fileToOpen = null; // Clear after sending
  return file;
});

// Handle opening a file programmatically  
ipcMain.handle('open-file', async (event, filePath) => {
  try {
    const stats = fs.statSync(filePath);
    return {
      path: filePath,
      name: path.basename(filePath),
      size: stats.size,
      type: path.extname(filePath).toLowerCase().slice(1)
    };
  } catch (error) {
    console.error('Error opening file:', error);
    return null;
  }
});