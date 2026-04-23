const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { exportQuote } = require('./quote-exporter');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 920,
    minHeight: 600,
    titleBarStyle: 'hiddenInset', // Native macOS feel (traffic lights integrated)
    trafficLightPosition: { x: 20, y: 22 },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  ipcMain.handle('export-quote', async (event, payload) => {
    return exportQuote({
      BrowserWindow,
      app,
      dialog,
      payload,
      parentWindow: BrowserWindow.fromWebContents(event.sender)
    });
  });

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
