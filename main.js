const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { execFile } = require('child_process');
const express = require('express');
const cors = require('cors');
const youtubedl = require('youtube-dl-exec');

const REPO_OWNER = 'CatarinaMaga';
const REPO_NAME = 'dj-flow-desktop';

const serverApp = express();
const PORT = 3891;

serverApp.use(cors());
serverApp.use(express.json());

// cofrePath será definido dentro do whenReady (único), antes de qualquer uso
let cofrePath = '';

// Fontes de áudio suportadas
const SUPPORTED_SOURCES = [
    'youtube.com',
    'youtu.be',
    'soundcloud.com',
    'bandcamp.com',
    'archive.org'
];

function isSupportedUrl(url) {
    try {
        const parsed = new URL(url);
        return SUPPORTED_SOURCES.some(source => parsed.hostname.includes(source));
    } catch (e) {
        return false;
    }
}

function getCleanUrl(rawUrl) {
    try {
        const parsed = new URL(rawUrl);
        if (parsed.hostname.includes('youtube.com') && parsed.searchParams.has('v')) {
            return `https://www.youtube.com/watch?v=${parsed.searchParams.get('v')}`;
        }
        if (parsed.hostname.includes('youtu.be')) {
            return `https://youtu.be${parsed.pathname}`;
        }
        // Para SoundCloud, Bandcamp e Archive.org retorna a URL limpa sem parâmetros extras
        return `${parsed.origin}${parsed.pathname}`;
    } catch (e) {
        return rawUrl.split('&')[0];
    }
}

// Endpoint: Fazer download físico para o Cofre
serverApp.get('/download/disk', async (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl || !isSupportedUrl(videoUrl)) {
        return res.status(400).json({ error: 'URL inválida ou fonte não suportada. Use YouTube, SoundCloud, Bandcamp ou Archive.org.' });
    }

    if (!cofrePath) {
        return res.status(500).json({ error: 'Cofre ainda não foi inicializado. Aguarde um momento e tente novamente.' });
    }
    
    const cleanVideoUrl = getCleanUrl(videoUrl);

    try {
        const binPath = path.join(__dirname, 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp.exe');
        
        console.log(`Iniciando download materializado: ${cleanVideoUrl}`);
        console.log(`Pasta destino: ${cofrePath}`);
        
        const logPath = path.join(app.getPath('userData'), 'download-debug.log');
        fs.appendFileSync(logPath, `\n[${new Date().toISOString()}] Baixando: ${cleanVideoUrl}\nDestino: ${cofrePath}\n`);

        // Formato com fallback: tenta m4a, depois melhor áudio disponível
        await youtubedl.exec(cleanVideoUrl, {
            format: 'bestaudio[ext=m4a]/bestaudio/best',
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

// Endpoint: Buscar Info da faixa
serverApp.get('/info/youtube', async (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl || !isSupportedUrl(videoUrl)) {
        return res.status(400).json({ error: 'URL inválida ou fonte não suportada.' });
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
        
        const parsedInfo = typeof info === 'string' ? JSON.parse(info) : info;

        res.json({
            success: true,
            title: parsedInfo.title || 'Áudio Desconhecido',
            thumbnail: parsedInfo.thumbnail || '',
            duration: parsedInfo.duration_string || ''
        });
    } catch (err) {
        console.error('Erro ao buscar info:', err);
        res.status(500).json({ error: 'Faixa indisponível ou link inválido.' });
    }
});

// Endpoint para ajudar o usuário a abrir a pasta visualmente no File Explorer
serverApp.get('/open-folder', (req, res) => {
    if (!cofrePath) {
        return res.status(500).json({ error: 'Cofre ainda não inicializado.' });
    }
    shell.openPath(cofrePath);
    res.json({ success: true });
});

// Endpoint: atualizar o motor de download (yt-dlp) para a versão mais recente.
// O YouTube muda o comportamento com frequência e versões antigas do yt-dlp
// param de funcionar; rodar "-U" atualiza o binário embutido para a build
// estável mais recente do próprio yt-dlp.
serverApp.get('/update-engine', async (req, res) => {
    try {
        const result = await updateYtDlp();
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message || 'Falha ao atualizar o motor de download.' });
    }
});

// Catch-all para evitar retornar HTML em caso de erro de rota ou 404
serverApp.use((req, res) => {
    res.status(404).json({ error: 'Rota não encontrada no backend do DJ Flow.' });
});

let localServer;
let mainWindow;

// Roda "yt-dlp -U" para atualizar o binário embutido para a versão estável
// mais recente. O yt-dlp já traz self-update de fábrica (flag -U), então não
// precisamos baixar/substituir o executável manualmente.
function updateYtDlp() {
    return new Promise((resolve, reject) => {
        const binPath = path.join(__dirname, 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp.exe');
        const logPath = path.join(app.getPath('userData'), 'download-debug.log');

        execFile(binPath, ['-U'], { timeout: 30000 }, (err, stdout, stderr) => {
            const output = (stdout || '') + (stderr || '');
            fs.appendFileSync(logPath, `\n[${new Date().toISOString()}] Update yt-dlp:\n${output}\n`);

            if (err) {
                reject(new Error('Não foi possível verificar atualizações do motor de download.'));
                return;
            }
            resolve({ success: true, message: output.trim() || 'yt-dlp já está atualizado.' });
        });
    });
}

// Compara "1.2.10" com "1.3.0" sem precisar de dependência de semver.
function isNewerVersion(remote, current) {
    const r = remote.replace(/^v/, '').split('.').map(Number);
    const c = current.replace(/^v/, '').split('.').map(Number);
    for (let i = 0; i < Math.max(r.length, c.length); i++) {
        const rv = r[i] || 0;
        const cv = c[i] || 0;
        if (rv > cv) return true;
        if (rv < cv) return false;
    }
    return false;
}

// Verifica no GitHub Releases se existe uma versão do próprio DJ Flow mais
// nova que a instalada. Não baixa nem instala nada sozinho — só avisa o
// usuário e aponta para a página de download.
function checkForAppUpdate(win) {
    const options = {
        hostname: 'api.github.com',
        path: `/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`,
        headers: { 'User-Agent': 'dj-flow-desktop' },
        timeout: 8000
    };

    const req = https.get(options, (res) => {
        if (res.statusCode !== 200) {
            res.resume(); // sem releases publicadas ainda (404) ou erro passageiro — ignora
            return;
        }

        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
            try {
                const release = JSON.parse(body);
                const latestVersion = (release.tag_name || '').replace(/^v/, '');
                const currentVersion = app.getVersion();

                if (latestVersion && isNewerVersion(latestVersion, currentVersion)) {
                    win.webContents.send('app-update-available', {
                        version: latestVersion,
                        url: release.html_url
                    });
                }
            } catch (e) {
                // Resposta inesperada da API do GitHub — não é crítico, ignora.
            }
        });
    });

    req.on('error', () => {});
    req.on('timeout', () => req.destroy());
}

function createWindow () {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 520, // Caixinha retangular vertical (Estilo Widget)
    icon: path.join(__dirname, 'assets/icon.png'), // Ícone da Janela
    backgroundColor: '#121212',
    title: 'DJ Flow - Rekordbox Companion',
    autoHideMenuBar: true,
    alwaysOnTop: true, // Magia para ficar acima do Rekordbox
    resizable: false, // Fixa para não atrapalhar o Rekordbox
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Links com target="_blank" (ex.: aviso de nova versão) abrem no navegador
  // padrão do usuário em vez de uma nova janela Electron.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
  });

  mainWindow.webContents.once('did-finish-load', () => {
      checkForAppUpdate(mainWindow);
  });
}

// Único ponto de entrada whenReady: inicializa cofre, servidor e janela em sequência
app.whenReady().then(() => {
  // 1. Criar a "Gaveta/Cofre DJ" na pasta Música do usuário
  cofrePath = path.join(app.getPath('music'), 'Cofre DJ Flow');
  if (!fs.existsSync(cofrePath)) {
      fs.mkdirSync(cofrePath, { recursive: true });
  }

  // 2. Iniciar servidor local
  localServer = serverApp.listen(PORT, () => {
      console.log(`Porta ${PORT} pronta para Download Bridge.`);
  }).on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
          console.log(`A porta ${PORT} já está em uso por outro programa. Tente fechar outras instâncias.`);
      }
  });

  // 3. Criar janela principal
  createWindow();

  // 4. Atualizar o yt-dlp em segundo plano (não bloqueia a janela).
  //    Falha silenciosamente: se não houver internet agora, tenta de novo
  //    na próxima abertura do app.
  updateYtDlp().catch(() => {});
});

app.on('window-all-closed', () => {
  if (localServer) localServer.close();
  if (process.platform !== 'darwin') app.quit();
});
app.on('quit', () => {
  if (localServer) localServer.close();
});

// IPC: fechar o app quando o usuário rejeitar os termos
ipcMain.on('app-quit', () => {
  if (localServer) localServer.close();
  app.quit();
});
