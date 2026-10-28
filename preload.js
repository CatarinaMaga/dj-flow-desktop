const { contextBridge, ipcRenderer } = require('electron');

// Ponte segura entre o renderer (index.html/js) e o processo main.
// Com nodeIntegration desligado, o renderer não tem mais acesso direto ao
// Node/Electron — só ao que expormos explicitamente aqui.
contextBridge.exposeInMainWorld('djflow', {
    apiToken: ipcRenderer.sendSync('get-api-token'),
    appVersion: ipcRenderer.sendSync('get-app-version'),
    quitApp: () => ipcRenderer.send('app-quit'),
    reportLanguage: (lang) => ipcRenderer.send('ui-language', lang),
    definirTema: (tema) => ipcRenderer.send('ui-tema', tema),
    lerAreaDeTransferencia: () => ipcRenderer.invoke('ler-area-de-transferencia'),
    baixarAtualizacao: () => ipcRenderer.invoke('baixar-atualizacao'),
    instalarAtualizacao: () => ipcRenderer.invoke('instalar-atualizacao'),
    onAtualizacaoProgresso: (callback) => {
        ipcRenderer.on('atualizacao-progresso', (_event, pct) => callback(pct));
    },
    onUpdateAvailable: (callback) => {
        ipcRenderer.on('app-update-available', (_event, info) => callback(info));
    }
});
