const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const youtubedl = require('youtube-dl-exec');

const serverApp = express();
const PORT = 3891;

serverApp.use(cors());
serverApp.use(express.json());

// 1. Criar a "Gaveta/Cofre DJ" no Windows do Usuário assim que iniciar
let cofrePath = '';
app.whenReady().then(() => {
    // Apontar para C:\Users\NomeUsuario\Music\Cofre DJ Flow (Para fugir do OneDrive de Documentos que está lotado)
    cofrePath = path.join(app.getPath('music'), 'Cofre DJ Flow');
    if (!fs.existsSync(cofrePath)) {
        fs.mkdirSync(cofrePath, { recursive: true });
    }
});

function getCleanUrl(rawUrl) {
    try {
        const parsed = new URL(rawUrl);
        if (parsed.hostname.includes('youtube.com') && parsed.searchParams.has('v')) {
            return `https://www.youtube.com/watch?v=${parsed.searchParams.get('v')}`;
        }
        if (parsed.hostname.includes('youtu.be')) {
            return `https://youtu.be${parsed.pathname}`;
        }
        return rawUrl.split('&')[0];
    } catch (e) {
        return rawUrl.split('&')[0];
    }
}

// 2. Novo Endpoint: Fazer download físico para o Cofre
serverApp.get('/download/disk', async (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl || (!videoUrl.includes('youtu') && !videoUrl.includes('youtube.com'))) {
        return res.status(400).json({ error: 'URL Inválida' });
    }
    
    const cleanVideoUrl = getCleanUrl(videoUrl);

    try {
        const binPath = path.join(__dirname, 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp.exe');
        
        console.log(`Iniciando download materializado: ${cleanVideoUrl}`);
        console.log(`Pasta destino: ${cofrePath}`);
        
        // Log para Debug físico caso console.log não apareça pro usuário
        const logPath = path.join(app.getPath('userData'), 'download-debug.log');
        fs.appendFileSync(logPath, `\n[${new Date().toISOString()}] Baixando: ${cleanVideoUrl}\nDestino: ${cofrePath}\n`);

        await youtubedl.exec(cleanVideoUrl, {
            format: 'bestaudio[ext=m4a]',
            output: '%(title)s.%(ext)s',
            noWarnings: true,
            noCheckCertificates: true,
            restrictFilenames: true,
            noPlaylist: true,
            noCacheDir: true
        }, { 
            cwd: cofrePath,
            executablePath: binPath
        });
        
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] Execução concluída com sucesso.\n`);
        res.json({ success: true, message: 'Arquivo materializado no Cofre!' });
    } catch (err) {
        console.error('Erro no download:', err);
        const logPath = path.join(app.getPath('userData'), 'download-debug.log');
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] ERRO: ${err.message}\n`);
        res.status(500).json({ error: err.message || 'Falha durante o download.' });
    }
});

// 3. Novo Endpoint: Buscar Info do Vídeo
serverApp.get('/info/youtube', async (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl || (!videoUrl.includes('youtu') && !videoUrl.includes('youtube.com'))) {
        return res.status(400).json({ error: 'URL Inválida' });
    }
    
    const cleanVideoUrl = getCleanUrl(videoUrl);

    try {
        const binPath = path.join(__dirname, 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp.exe');

        const info = await youtubedl(cleanVideoUrl, { 
            dumpJson: true, 
            noCheckCertificates: true, 
            noWarnings: true, 
            skipDownload: true,
            noPlaylist: true
        }, {
            executablePath: binPath
        });
        
        // Se info vier como string, precisamos tentar parsear (comportamento varia por versão)
        const parsedInfo = typeof info === 'string' ? JSON.parse(info) : info;

        res.json({
            success: true,
            title: parsedInfo.title || 'Áudio Desconhecido',
            thumbnail: parsedInfo.thumbnail || '',
            duration: parsedInfo.duration_string || ''
        });
    } catch (err) {
        console.error('Erro ao buscar info:', err);
        res.status(500).json({ error: 'Vídeo indisponível ou link inválido.' });
    }
});

// Endpoint para ajudar o usuário a abrir a pasta visualmente no File Explorer
serverApp.get('/open-folder', (req, res) => {
    shell.openPath(cofrePath);
    res.json({ success: true });
});

// Catch-all para evitar retornar HTML em caso de erro de rota ou 404
serverApp.use((req, res) => {
    res.status(404).json({ error: 'Rota não encontrada no backend do DJ Flow.' });
});

let localServer;

function createWindow () {
  const mainWindow = new BrowserWindow({
    width: 400,
    height: 520, // Caixinha retangular vertical (Estilo Widget)
    icon: path.join(__dirname, 'assets/icon.png'), // Ícone da Janela
    backgroundColor: '#121212',
    title: 'DJ Flow - Rekordbox Companion',
    autoHideMenuBar: true,
    alwaysOnTop: true, // Magia para ficar acima do RecordBox
    resizable: false, // Fixa para não atrapalhar o Rekordbox
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  localServer = serverApp.listen(PORT, () => {
      console.log(`Porta ${PORT} pronta para Download Bridge.`);
  }).on('error', (err) => {
      if(err.code === 'EADDRINUSE') {
          console.log(`A porta ${PORT} já está em uso por outro programa. Tente fechar outras instâncias.`);
      }
  });
  
  createWindow();
});

app.on('window-all-closed', () => {
  if (localServer) localServer.close();
  if (process.platform !== 'darwin') app.quit();
});
app.on('quit', () => {
  if (localServer) localServer.close();
});
