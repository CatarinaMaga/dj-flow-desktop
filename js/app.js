document.addEventListener('DOMContentLoaded', () => {

    // ── Tela de Aceite ─────────────────────────────────────────────────────────
    const termsOverlay  = document.getElementById('terms-overlay');
    const btnAccept     = document.getElementById('btn-accept-terms');
    const btnReject     = document.getElementById('btn-reject-terms');

    const TERMS_KEY = 'djflow_terms_accepted';

    if (!localStorage.getItem(TERMS_KEY)) {
        termsOverlay.style.display = 'flex';
    }

    btnAccept.addEventListener('click', () => {
        localStorage.setItem(TERMS_KEY, '1');
        termsOverlay.style.display = 'none';
    });

    btnReject.addEventListener('click', () => {
        // Fecha o app via ponte exposta pelo preload.js (contextIsolation ligado
        // não dá acesso direto ao Electron aqui), senão fecha a janela.
        if (window.djflow) {
            window.djflow.quitApp();
        } else {
            window.close();
        }
    });

    // ── Fontes suportadas (espelha o backend) ──────────────────────────────────
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
            return SUPPORTED_SOURCES.some(s => parsed.hostname.includes(s));
        } catch (e) {
            return false;
        }
    }

    // ── Elementos principais ───────────────────────────────────────────────────
    const input         = document.getElementById('yt-link-input');
    const btnDownload   = document.getElementById('btn-download');
    const btnFolder     = document.getElementById('btn-folder');
    const btnUpdateEngine = document.getElementById('btn-update-engine');
    const logList       = document.getElementById('download-log');
    const trackPreview  = document.getElementById('track-preview');
    const previewThumb  = document.getElementById('preview-thumb');
    const previewTitle  = document.getElementById('preview-title');
    const previewDuration = document.getElementById('preview-duration');

    let logInitialized  = false;
    let currentTrackInfo = null;

    // ── Persistência do log entre sessões ──────────────────────────────────────
    const LOG_STORAGE_KEY = 'djflow_activity_log';
    const MAX_STORED_LOGS = 50;

    function loadStoredLogs() {
        try {
            const saved = JSON.parse(localStorage.getItem(LOG_STORAGE_KEY) || '[]');
            if (!Array.isArray(saved) || saved.length === 0) return;

            logList.innerHTML = '';
            logInitialized = true;
            // Salvos do mais novo pro mais antigo; renderiza na mesma ordem (prepend inverteria de novo)
            saved.forEach(entry => {
                const li = document.createElement('li');
                li.style.color = entry.color;
                li.innerHTML = `<span style="opacity:0.4">[${entry.time}]</span> ${entry.msg}`;
                logList.appendChild(li);
            });
        } catch (e) {
            console.warn('Falha ao carregar histórico de atividade salvo:', e);
            localStorage.removeItem(LOG_STORAGE_KEY);
        }
    }

    function persistLog(time, msg, color) {
        try {
            const saved = JSON.parse(localStorage.getItem(LOG_STORAGE_KEY) || '[]');
            saved.unshift({ time, msg, color });
            localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(saved.slice(0, MAX_STORED_LOGS)));
        } catch (e) {
            console.warn('Falha ao salvar histórico de atividade:', e);
        }
    }

    function addLog(msg, color = "#ccc") {
        if (!logInitialized) {
            logList.innerHTML = '';
            logInitialized = true;
        }
        const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const li = document.createElement('li');
        li.style.color = color;
        li.innerHTML = `<span style="opacity:0.4">[${time}]</span> ${msg}`;
        logList.prepend(li);
        persistLog(time, msg, color);
    }

    loadStoredLogs();

    // ── Aviso de nova versão do DJ Flow disponível ─────────────────────────────
    if (window.djflow) {
        window.djflow.onUpdateAvailable((info) => {
            addLog(`⬆️ Nova versão disponível: v${info.version}. <a href="${info.url}" target="_blank" style="color:var(--accent-cyan)">Baixar</a>`, 'var(--accent-cyan)');
        });
    }

    // ── Detecção de URL com debounce ───────────────────────────────────────────
    let timeout = null;
    input.addEventListener('input', () => {
        const url = input.value.trim();
        clearTimeout(timeout);

        if (!url || !isSupportedUrl(url)) {
            trackPreview.style.display = 'none';
            btnDownload.disabled = true;
            return;
        }

        timeout = setTimeout(fetchTrackInfo, 600);
    });

    // ── Busca info da faixa ────────────────────────────────────────────────────
    async function fetchTrackInfo() {
        const url = input.value.trim();
        if (!url) return;

        addLog(`🔍 Analisando link...`, 'var(--accent-cyan)');

        try {
            const res = await fetch(`http://localhost:3891/info/youtube?url=${encodeURIComponent(url)}`);

            const contentType = res.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await res.text();
                console.error('Resposta não-JSON:', text.substring(0, 100));
                throw new Error('O servidor local retornou um formato inesperado. Verifique se há outro programa usando a porta 3891.');
            }

            const data = await res.json();
            if (data.error) throw new Error(data.error);

            currentTrackInfo = data;

            previewTitle.textContent = data.title;
            previewDuration.textContent = data.duration || '';
            previewThumb.style.backgroundImage = data.thumbnail ? `url(${data.thumbnail})` : 'none';

            trackPreview.style.display = 'flex';
            btnDownload.disabled = false;
            addLog(`⭐ Pronto: ${data.title.substring(0, 40)}${data.title.length > 40 ? '...' : ''}`, 'var(--accent-green)');

        } catch (e) {
            console.error(e);
            addLog(`❌ ERRO: ${e.message}`, 'var(--danger)');
            trackPreview.style.display = 'none';
            btnDownload.disabled = true;
        }
    }

    // ── Download ───────────────────────────────────────────────────────────────
    btnDownload.addEventListener('click', async () => {
        const url = input.value.trim();
        if (!url) return;

        input.value = '';
        btnDownload.disabled = true;
        trackPreview.style.display = 'none';

        const originalText = btnDownload.innerHTML;
        btnDownload.innerHTML = `<span class="icon">⏳</span> Materializando no Cofre...`;

        addLog(`🚀 Iniciando download...`, 'var(--accent-purple)');

        try {
            const res = await fetch(`http://localhost:3891/download/disk?url=${encodeURIComponent(url)}`);

            const contentType = res.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Erro de comunicação com o motor (Porta 3891 ocupada).');
            }

            const data = await res.json();
            if (data.error) throw new Error(data.error);

            addLog(`✅ "${currentTrackInfo?.title || 'Arquivo'}" salvo no Cofre!`, 'var(--accent-green)');
            currentTrackInfo = null;

        } catch (e) {
            addLog(`❌ ERRO: ${e.message}`, 'var(--danger)');
        } finally {
            btnDownload.disabled = true;
            btnDownload.innerHTML = originalText;
        }
    });

    // ── Abrir pasta ────────────────────────────────────────────────────────────
    btnFolder.addEventListener('click', async () => {
        try {
            await fetch(`http://localhost:3891/open-folder`);
        } catch (e) {
            console.error('Erro ao abrir pasta', e);
            addLog(`❌ Não foi possível abrir a pasta.`, 'var(--danger)');
        }
    });

    // ── Atualizar motor de download (yt-dlp) ───────────────────────────────────
    btnUpdateEngine.addEventListener('click', async () => {
        const originalText = btnUpdateEngine.innerHTML;
        btnUpdateEngine.disabled = true;
        btnUpdateEngine.innerHTML = `<span class="icon">⏳</span> Verificando...`;
        addLog(`🔄 Verificando atualização do motor de download...`, 'var(--accent-cyan)');

        try {
            const res = await fetch(`http://localhost:3891/update-engine`);
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            addLog(`✅ Motor de download OK: ${data.message}`, 'var(--accent-green)');
        } catch (e) {
            addLog(`❌ ERRO ao atualizar motor: ${e.message}`, 'var(--danger)');
        } finally {
            btnUpdateEngine.disabled = false;
            btnUpdateEngine.innerHTML = originalText;
        }
    });
});
