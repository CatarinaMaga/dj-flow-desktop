const { contextBridge, ipcRenderer } = require('electron');

// Ponte segura entre o renderer (index.html/js) e o processo main.
// Com nodeIntegration desligado, o renderer não tem mais acesso direto ao
// Node/Electron — só ao que expormos explicitamente aqui.
contextBridge.exposeInMainWorld('djflow', {
    apiToken: ipcRenderer.sendSync('get-api-token'),
    appVersion: ipcRenderer.sendSync('get-app-version'),
    quitApp: () => ipcRenderer.send('app-quit'),
    reportLanguage: (lang) => ipcRenderer.send('ui-language', lang),
    onUpdateAvailable: (callback) => {
        ipcRenderer.on('app-update-available', (_event, info) => callback(info));
    }
});
