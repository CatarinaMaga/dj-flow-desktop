const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');
const { execFile } = require('child_process');
const express = require('express');
const cors = require('cors');
const youtubedl = require('youtube-dl-exec');

const REPO_OWNER = 'CatarinaMaga';
const REPO_NAME = 'dj-flow-desktop';

const serverApp = express();
const PORT = 3891;

// Chave gerada a cada abertura e entregue só à janela do app (via preload).
// Sem ela, sites abertos no navegador conseguiriam chamar este servidor e
// ler os arquivos do Cofre, já que o CORS precisa ficar liberado pro file://.
const API_TOKEN = crypto.randomUUID();

serverApp.use(cors());
serverApp.use(express.json());
serverApp.use((req, res, next) => {
    if (req.query.token !== API_TOKEN) {
        return res.status(401).json({ code: 'unauthorized', error: 'Acesso não autorizado ao backend do DJ Flow.' });
    }
    next();
});

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
        return res.status(400).json({ code: 'invalid_url', error: 'URL inválida ou fonte não suportada. Use YouTube, SoundCloud, Bandcamp ou Archive.org.' });
    }

    if (!cofrePath) {
        return res.status(500).json({ code: 'vault_not_ready', error: 'Cofre ainda não foi inicializado. Aguarde um momento e tente novamente.' });
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
        res.status(500).json({ code: 'download_failed', error: err.message || 'Falha durante o download.' });
    }
});

// Endpoint: Buscar Info da faixa
serverApp.get('/info/youtube', async (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl || !isSupportedUrl(videoUrl)) {
        return res.status(400).json({ code: 'invalid_url', error: 'URL inválida ou fonte não suportada.' });
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
            title: parsedInfo.title || '',
            thumbnail: parsedInfo.thumbnail || '',
            duration: parsedInfo.duration_string || ''
        });
    } catch (err) {
        console.error('Erro ao buscar info:', err);
        res.status(500).json({ code: 'track_unavailable', error: 'Faixa indisponível ou link inválido.' });
    }
});

// Endpoint: expandir um link em faixas. Um link de playlist/álbum vira vários
// itens; um link de faixa única devolve ele mesmo. Não baixa nada, só lista.
serverApp.get('/info/expand', async (req, res) => {
    const rawUrl = req.query.url;
    if (!rawUrl || !isSupportedUrl(rawUrl)) {
        return res.status(400).json({ code: 'invalid_url', error: 'URL inválida ou fonte não suportada.' });
    }

    try {
        const binPath = path.join(__dirname, 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp.exe');
        // exec() em vez da chamada normal: uma playlist devolve uma linha JSON por
        // faixa, e a versão normal tenta interpretar tudo como um único JSON e falha.
        const resultado = await youtubedl.exec(rawUrl, {
            dumpJson: true,
            flatPlaylist: true,
            skipDownload: true,
            noWarnings: true,
            noCheckCertificates: true
        }, { executablePath: binPath });

        const linhas = String(resultado.stdout || '').split('\n').map(l => l.trim()).filter(Boolean);
        const faixas = [];
        for (const linha of linhas) {
            let item;
            try { item = JSON.parse(linha); } catch (e) { continue; }
            const url = item.webpage_url || item.original_url || item.url ||
                (item.id ? `https://www.youtube.com/watch?v=${item.id}` : null);
            if (!url || !isSupportedUrl(url)) continue;
            faixas.push({ url, title: item.title || '' });
        }

        if (faixas.length === 0) faixas.push({ url: rawUrl, title: '' });
        res.json({ success: true, tracks: faixas });
    } catch (err) {
        console.error('Erro ao expandir link:', err);
        res.status(500).json({ code: 'track_unavailable', error: 'Faixa indisponível ou link inválido.' });
    }
});

// Endpoint para ajudar o usuário a abrir a pasta visualmente no File Explorer
serverApp.get('/open-folder', (req, res) => {
    if (!cofrePath) {
        return res.status(500).json({ code: 'vault_not_ready', error: 'Cofre ainda não inicializado.' });
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
        res.status(500).json({ code: 'engine_update_failed', error: err.message || 'Falha ao atualizar o motor de download.' });
    }
});

const AUDIO_EXTENSIONS = new Set(['.mp3', '.m4a', '.aac', '.flac', '.wav', '.aif', '.aiff', '.ogg', '.opus', '.webm']);

// Aceita só um nome de arquivo solto do Cofre (sem pastas), pra ninguém
// usar "..\" e ler arquivos de fora dele.
function resolveCofreAudio(name) {
    if (typeof name !== 'string' || !name || name !== path.basename(name)) return null;
    if (!AUDIO_EXTENSIONS.has(path.extname(name).toLowerCase())) return null;
    const fullPath = path.join(cofrePath, name);
    return fs.existsSync(fullPath) ? fullPath : null;
}

// Endpoint: listar os áudios do Cofre para o detector de qualidade
serverApp.get('/quality/files', (req, res) => {
    if (!cofrePath) {
        return res.status(500).json({ code: 'vault_not_ready', error: 'Cofre ainda não inicializado.' });
    }
    const files = fs.readdirSync(cofrePath, { withFileTypes: true })
        .filter(entry => entry.isFile() && AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
        .map(entry => ({
            name: entry.name,
            ext: path.extname(entry.name).slice(1).toLowerCase(),
            size: fs.statSync(path.join(cofrePath, entry.name)).size
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    res.json({ files });
});

// Endpoint: entregar um áudio do Cofre para análise no app
serverApp.get('/quality/file', (req, res) => {
    const fullPath = cofrePath && resolveCofreAudio(req.query.name);
    if (!fullPath) {
        return res.status(404).json({ code: 'file_not_found', error: 'Arquivo não encontrado no Cofre.' });
    }
    res.sendFile(fullPath);
});

// Catch-all para evitar retornar HTML em caso de erro de rota ou 404
serverApp.use((req, res) => {
    res.status(404).json({ code: 'route_not_found', error: 'Rota não encontrada no backend do DJ Flow.' });
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
            // O yt-dlp responde em inglês, ex.: "yt-dlp is up to date (stable@2026.08.19 ...)"
            // ou "Updated yt-dlp to stable@2026.09.10 ...". A última versão citada é a instalada.
            const versions = [...output.matchAll(/stable@(\d{4})\.(\d{2})\.(\d{2})/g)];
            const last = versions[versions.length - 1];
            resolve({
                success: true,
                upToDate: /is up to date/i.test(output),
                updated: /Updated yt-dlp to/i.test(output),
                versionDate: last ? `${last[1]}-${last[2]}-${last[3]}` : null
            });
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

// Menu do botão direito: o Electron não traz um por padrão, então sem isto só
// funcionariam os atalhos de teclado (Ctrl+C / Ctrl+V).
const MENU_LABELS = {
  pt: { undo: 'Desfazer', redo: 'Refazer', cut: 'Recortar', copy: 'Copiar', paste: 'Colar', selectAll: 'Selecionar tudo' },
  en: { undo: 'Undo', redo: 'Redo', cut: 'Cut', copy: 'Copy', paste: 'Paste', selectAll: 'Select all' }
};
let uiLang = 'pt';

ipcMain.on('ui-language', (event, lang) => {
  if (MENU_LABELS[lang]) uiLang = lang;
});

function buildContextMenu(params) {
  const labels = MENU_LABELS[uiLang];
  const items = [];

  if (params.isEditable) {
    items.push({ role: 'undo', label: labels.undo }, { role: 'redo', label: labels.redo }, { type: 'separator' });
    items.push({ role: 'cut', label: labels.cut, enabled: params.selectionText.length > 0 });
  }
  if (params.isEditable || params.selectionText.length > 0) {
    items.push({ role: 'copy', label: labels.copy, enabled: params.selectionText.length > 0 });
  }
  if (params.isEditable) {
    items.push({ role: 'paste', label: labels.paste }, { type: 'separator' }, { role: 'selectAll', label: labels.selectAll });
  }
  return items.length ? Menu.buildFromTemplate(items) : null;
}

function createWindow () {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 680, // Caixinha retangular vertical (Estilo Widget); abaixo disso o registro fica sem espaço
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

  mainWindow.webContents.on('context-menu', (event, params) => {
      const menu = buildContextMenu(params);
      if (menu) menu.popup({ window: mainWindow, x: params.x, y: params.y });
  });

  mainWindow.webContents.once('did-finish-load', () => {
      checkForAppUpdate(mainWindow);
  });
}

// Uma janela só: uma segunda instância não conseguiria abrir a porta 3891 (já
// ocupada pela primeira) e todas as chamadas dela voltariam "não autorizado",
// porque cairiam no servidor da primeira, que usa outra chave.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
}

// Único ponto de entrada whenReady: inicializa cofre, servidor e janela em sequência
app.whenReady().then(() => {
  if (!gotSingleInstanceLock) return;

  // 1. Criar a "Gaveta/Cofre DJ" na pasta Música do usuário
  cofrePath = path.join(app.getPath('music'), 'Cofre DJ Flow');
  if (!fs.existsSync(cofrePath)) {
      fs.mkdirSync(cofrePath, { recursive: true });
  }

  // 2. Iniciar servidor local
  localServer = serverApp.listen(PORT, '127.0.0.1', () => {
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

ipcMain.on('get-api-token', (event) => {
  event.returnValue = API_TOKEN;
});

ipcMain.on('get-app-version', (event) => {
  event.returnValue = app.getVersion();
});

// IPC: fechar o app quando o usuário rejeitar os termos
ipcMain.on('app-quit', () => {
  if (localServer) localServer.close();
  app.quit();
});
