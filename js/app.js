document.addEventListener('DOMContentLoaded', () => {

    const API_BASE = 'http://127.0.0.1:3891';
    const API_TOKEN = window.djflow ? window.djflow.apiToken : '';

    function apiUrl(route, params = {}) {
        const url = new URL(route, API_BASE);
        Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
        url.searchParams.set('token', API_TOKEN);
        return url.toString();
    }

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
            const res = await fetch(apiUrl('/info/youtube', { url }));

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
            const res = await fetch(apiUrl('/download/disk', { url }));

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
            await fetch(apiUrl('/open-folder'));
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
            const res = await fetch(apiUrl('/update-engine'));
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

    // ── Detector de qualidade ──────────────────────────────────────────────────
    // Faixas mais longas que isso (mixes, álbuns inteiros) são puladas: decodificar
    // 1 hora de áudio de uma vez ocuparia mais de 1 GB de memória.
    const MAX_ANALYSIS_SECONDS = 12 * 60;

    const qualityOverlay = document.getElementById('quality-overlay');
    const qualitySummary = document.getElementById('quality-summary');
    const qualityList    = document.getElementById('quality-list');
    let qualityScanRunning = false;

    function formatKhz(hz) {
        return (hz / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    }

    function readDuration(url) {
        return new Promise((resolve) => {
            const audio = new Audio();
            const finish = (value) => {
                clearTimeout(timer);
                audio.removeAttribute('src');
                audio.load();
                resolve(value);
            };
            const timer = setTimeout(() => finish(NaN), 15000);
            audio.preload = 'metadata';
            audio.addEventListener('loadedmetadata', () => finish(audio.duration), { once: true });
            audio.addEventListener('error', () => finish(NaN), { once: true });
            audio.src = url;
        });
    }

    function renderQualityItem(item, { badgeClass, badgeText, detail, suspicious }) {
        item.classList.toggle('suspicious', Boolean(suspicious));
        const badge = item.querySelector('.quality-badge');
        badge.className = `quality-badge ${badgeClass}`;
        badge.textContent = badgeText;
        item.querySelector('.quality-detail').textContent = detail;
    }

    async function analyzeCofreFile(file) {
        const url = apiUrl('/quality/file', { name: file.name });
        const duration = await readDuration(url);
        if (!Number.isFinite(duration) || duration <= 0) {
            return { badgeClass: 'erro', badgeText: 'Erro', detail: 'Não foi possível ler este arquivo.' };
        }
        if (duration > MAX_ANALYSIS_SECONDS) {
            return { badgeClass: '', badgeText: 'Pulada', detail: `Arquivo longo (${Math.round(duration / 60)} min), parece mix ou álbum inteiro.` };
        }

        const response = await fetch(url);
        if (!response.ok) throw new Error('arquivo indisponível');
        const { cutoffHz } = await QualityAnalyzer.analyzeArrayBuffer(await response.arrayBuffer());
        const avgKbps = (file.size * 8) / duration / 1000;
        const result = QualityAnalyzer.classify({ cutoffHz, avgKbps, ext: file.ext });

        return {
            level: result.level,
            suspicious: result.suspicious,
            badgeClass: result.suspicious ? 'muito-baixa' : result.level,
            badgeText: result.suspicious ? 'Suspeita' : result.label,
            detail: `~${Math.round(avgKbps)} kbps · agudos até ${formatKhz(cutoffHz)} kHz · ${result.advice}`
        };
    }

    async function scanCofreQuality() {
        if (qualityScanRunning) return;
        qualityScanRunning = true;
        qualityList.innerHTML = '';
        qualitySummary.textContent = 'Procurando faixas...';

        try {
            const res = await fetch(apiUrl('/quality/files'));
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            if (data.files.length === 0) {
                qualitySummary.textContent = 'Nenhum arquivo de áudio no Cofre ainda.';
                return;
            }

            const items = data.files.map(file => {
                const li = document.createElement('li');
                li.className = 'quality-item';
                li.innerHTML = '<div class="quality-row"><span class="quality-name"></span><span class="quality-badge">...</span></div><div class="quality-detail">Aguardando análise</div>';
                li.querySelector('.quality-name').textContent = file.name;
                li.querySelector('.quality-name').title = file.name;
                qualityList.appendChild(li);
                return li;
            });

            const counts = { alta: 0, media: 0, baixa: 0, 'muito-baixa': 0, suspeitas: 0, outras: 0 };
            for (let i = 0; i < data.files.length; i++) {
                qualitySummary.textContent = `Analisando ${i + 1} de ${data.files.length}...`;
                renderQualityItem(items[i], { badgeClass: '', badgeText: '...', detail: 'Analisando os agudos da faixa...' });
                try {
                    const result = await analyzeCofreFile(data.files[i]);
                    renderQualityItem(items[i], result);
                    if (result.level) counts[result.level]++;
                    else counts.outras++;
                    if (result.suspicious) counts.suspeitas++;
                } catch (e) {
                    counts.outras++;
                    console.error('Falha ao analisar', data.files[i].name, e);
                    renderQualityItem(items[i], { badgeClass: 'erro', badgeText: 'Erro', detail: 'Formato não suportado ou arquivo corrompido.' });
                }
            }

            const weak = counts.baixa + counts['muito-baixa'];
            qualitySummary.textContent = `${data.files.length} faixas: ${counts.alta} alta, ${counts.media} média, ${weak} baixa` +
                (counts.suspeitas ? `, ${counts.suspeitas} suspeita(s) de conversão` : '') +
                (counts.outras ? `, ${counts.outras} pulada(s) ou com erro.` : '.');
            addLog(`🎚️ Qualidade do Cofre: ${counts.alta} alta, ${counts.media} média, ${weak} baixa${counts.suspeitas ? `, ${counts.suspeitas} suspeita(s)` : ''}.`,
                weak || counts.suspeitas ? '#ffb86c' : 'var(--accent-green)');
        } catch (e) {
            qualitySummary.textContent = `Não foi possível analisar o Cofre: ${e.message}`;
        } finally {
            qualityScanRunning = false;
        }
    }

    document.getElementById('btn-quality').addEventListener('click', () => {
        qualityOverlay.hidden = false;
        scanCofreQuality();
    });

    document.getElementById('btn-quality-close').addEventListener('click', () => {
        qualityOverlay.hidden = true;
    });
});
