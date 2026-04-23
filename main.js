const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

function safeFilePart(value, fallback) {
  const normalized = String(value || fallback)
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\p{M}._ -]+/gu, '_')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized || fallback;
}

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
    return new Promise((resolve, reject) => {
      const printWin = new BrowserWindow({
        show: false,
        webPreferences: { nodeIntegration: false, contextIsolation: true }
      });
      
      printWin.loadFile(path.join(__dirname, 'quote-template', 'template.html'));

      printWin.webContents.on('did-finish-load', async () => {
        try {
          await printWin.webContents.executeJavaScript(`window.renderQuote(${JSON.stringify(payload)})`);
          const pdfData = await printWin.webContents.printToPDF({
            pageSize: 'A4',
            landscape: false,
            printBackground: true
          });
          
          const customerFileName = safeFilePart(payload.meta.customer?.companyName || payload.meta.customerName, 'KhachHang');
          const defaultPath = path.join(app.getPath('documents'), `BaoGia_NCT_${customerFileName}_${new Date().toISOString().slice(2,10).replace(/-/g,'')}.pdf`);
          
          const { filePath } = await dialog.showSaveDialog({
            title: 'Lưu báo giá PDF',
            defaultPath: defaultPath,
            filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
          });
          
          if (filePath) {
            fs.writeFileSync(filePath, pdfData);
            resolve(filePath);
          } else {
            resolve(null);
          }
        } catch (err) {
          reject(err);
        } finally {
          printWin.close();
        }
      });
    });
  });

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
