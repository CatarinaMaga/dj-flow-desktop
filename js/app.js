document.addEventListener('DOMContentLoaded', () => {

    const { t } = I18n;
    I18n.apply();

    const API_BASE = 'http://127.0.0.1:3891';
    const API_TOKEN = window.djflow ? window.djflow.apiToken : '';

    if (window.djflow && window.djflow.appVersion) {
        document.getElementById('app-version').textContent = `v${window.djflow.appVersion}`;
    }

    const langSelect = document.getElementById('lang-select');
    langSelect.value = I18n.lang;
    langSelect.addEventListener('change', () => {
        I18n.setLanguage(langSelect.value);
        location.reload();
    });

    function apiUrl(route, params = {}) {
        const url = new URL(route, API_BASE);
        Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
        url.searchParams.set('token', API_TOKEN);
        return url.toString();
    }

    // O servidor responde { code, error }; o code vira texto no idioma escolhido.
    function serverError(data) {
        const key = `errors.${data.code}`;
        const translated = data.code ? t(key) : key;
        return new Error(translated !== key ? translated : data.error);
    }

    async function fetchJson(route, params) {
        const res = await fetch(apiUrl(route, params));
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error(t('errors.bad_format'));
        }
        const data = await res.json();
        if (data.error) throw serverError(data);
        return data;
    }

    // ── Tela de Aceite ─────────────────────────────────────────────────────────
    const termsOverlay  = document.getElementById('terms-overlay');
    const TERMS_KEY = 'djflow_terms_accepted';

    if (!localStorage.getItem(TERMS_KEY)) {
        termsOverlay.style.display = 'flex';
    }

    document.getElementById('btn-accept-terms').addEventListener('click', () => {
        localStorage.setItem(TERMS_KEY, '1');
        termsOverlay.style.display = 'none';
    });

    document.getElementById('btn-reject-terms').addEventListener('click', () => {
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
    const input           = document.getElementById('yt-link-input');
    const btnDownload     = document.getElementById('btn-download');
    const btnUpdateEngine = document.getElementById('btn-update-engine');
    const logList         = document.getElementById('download-log');
    const trackPreview    = document.getElementById('track-preview');
    const previewThumb    = document.getElementById('preview-thumb');
    const previewTitle    = document.getElementById('preview-title');
    const previewDuration = document.getElementById('preview-duration');

    let logInitialized  = false;
    let currentTrackInfo = null;

    // ── Registro de atividade (persistido entre sessões) ───────────────────────
    // As mensagens são sempre inseridas como texto: elas carregam títulos de
    // faixas e erros vindos de fora, e um título com HTML não pode virar código.
    const LOG_STORAGE_KEY = 'djflow_activity_log';
    const MAX_STORED_LOGS = 50;

    function buildLogItem({ time, msg, color, link }) {
        const li = document.createElement('li');
        li.style.color = color;
        const stamp = document.createElement('span');
        stamp.style.opacity = '0.4';
        stamp.textContent = `[${time}]`;
        li.append(stamp, ` ${msg}`);
        if (link && /^https:\/\//.test(link.url)) {
            const a = document.createElement('a');
            a.href = link.url;
            a.target = '_blank';
            a.rel = 'noopener';
            a.style.color = 'var(--accent-cyan)';
            a.textContent = link.label;
            li.append(' ', a);
        }
        return li;
    }

    function loadStoredLogs() {
        try {
            const saved = JSON.parse(localStorage.getItem(LOG_STORAGE_KEY) || '[]');
            if (!Array.isArray(saved) || saved.length === 0) return;

            logList.innerHTML = '';
            logInitialized = true;
            saved.forEach(entry => {
                // Entradas das versões antigas eram salvas com HTML; mostra só o texto.
                const msg = String(entry.msg).replace(/<[^>]*>/g, '');
                logList.appendChild(buildLogItem({ ...entry, msg }));
            });
        } catch (e) {
            console.warn('Falha ao carregar histórico de atividade salvo:', e);
            localStorage.removeItem(LOG_STORAGE_KEY);
        }
    }

    function persistLog(entry) {
        try {
            const saved = JSON.parse(localStorage.getItem(LOG_STORAGE_KEY) || '[]');
            saved.unshift(entry);
            localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(saved.slice(0, MAX_STORED_LOGS)));
        } catch (e) {
            console.warn('Falha ao salvar histórico de atividade:', e);
        }
    }

    function addLog(msg, color = '#ccc', link = null) {
        if (!logInitialized) {
            logList.innerHTML = '';
            logInitialized = true;
        }
        const entry = { time: I18n.formatTime(new Date()), msg, color, link };
        logList.prepend(buildLogItem(entry));
        persistLog(entry);
    }

    loadStoredLogs();

    // ── Aviso de nova versão do DJ Flow disponível ─────────────────────────────
    if (window.djflow) {
        window.djflow.onUpdateAvailable((info) => {
            addLog(t('log.updateAvailable', { version: info.version }), 'var(--accent-cyan)',
                { url: info.url, label: t('log.updateDownload') });
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

    function shortTitle(title) {
        return title.length > 40 ? `${title.substring(0, 40)}...` : title;
    }

    // ── Busca info da faixa ────────────────────────────────────────────────────
    async function fetchTrackInfo() {
        const url = input.value.trim();
        if (!url) return;

        addLog(t('log.analyzingLink'), 'var(--accent-cyan)');

        try {
            const data = await fetchJson('/info/youtube', { url });
            currentTrackInfo = data;
            const title = data.title || t('log.fileFallback');

            previewTitle.textContent = title;
            previewDuration.textContent = data.duration || '';
            previewThumb.style.backgroundImage = /^https:\/\//.test(data.thumbnail) ? `url("${encodeURI(data.thumbnail)}")` : 'none';

            trackPreview.style.display = 'flex';
            btnDownload.disabled = false;
            addLog(t('log.ready', { title: shortTitle(title) }), 'var(--accent-green)');

        } catch (e) {
            console.error(e);
            addLog(t('log.error', { message: e.message }), 'var(--danger)');
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
        btnDownload.innerHTML = t('main.downloading');

        addLog(t('log.downloadStart'), 'var(--accent-purple)');

        try {
            await fetchJson('/download/disk', { url });
            addLog(t('log.saved', { title: currentTrackInfo?.title || t('log.fileFallback') }), 'var(--accent-green)');
            currentTrackInfo = null;
        } catch (e) {
            const message = e.message === t('errors.bad_format') ? t('errors.engine_unreachable') : e.message;
            addLog(t('log.error', { message }), 'var(--danger)');
        } finally {
            btnDownload.disabled = true;
            btnDownload.innerHTML = t('main.download');
        }
    });

    // ── Abrir pasta ────────────────────────────────────────────────────────────
    document.getElementById('btn-folder').addEventListener('click', async () => {
        try {
            await fetchJson('/open-folder');
        } catch (e) {
            console.error('Erro ao abrir pasta', e);
            addLog(t('log.folderError'), 'var(--danger)');
        }
    });

    // ── Atualizar motor de download (yt-dlp) ───────────────────────────────────
    btnUpdateEngine.addEventListener('click', async () => {
        btnUpdateEngine.disabled = true;
        btnUpdateEngine.innerHTML = t('main.checking');
        addLog(t('log.engineChecking'), 'var(--accent-cyan)');

        try {
            const data = await fetchJson('/update-engine');
            const today = I18n.formatDate(new Date());
            // versionDate chega como "AAAA-MM-DD"; em UTC pra não virar o dia anterior no fuso do Brasil.
            const date = data.versionDate ? I18n.formatDate(new Date(`${data.versionDate}T00:00:00Z`), { utc: true }) : null;
            let message;
            if (data.updated && date) {
                message = t('log.engineUpdated', { date });
            } else if (date) {
                message = t('log.engineUpToDate', { date, today });
            } else {
                message = t('log.engineChecked', { today });
            }
            addLog(message, 'var(--accent-green)');
        } catch (e) {
            addLog(t('log.engineError', { message: e.message }), 'var(--danger)');
        } finally {
            btnUpdateEngine.disabled = false;
            btnUpdateEngine.textContent = t('main.updateEngine');
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
            return { badgeClass: 'erro', badgeText: t('quality.badge.error'), detail: t('quality.unreadable') };
        }
        if (duration > MAX_ANALYSIS_SECONDS) {
            return { badgeClass: '', badgeText: t('quality.badge.skipped'), detail: t('quality.long', { minutes: Math.round(duration / 60) }) };
        }

        const response = await fetch(url);
        if (!response.ok) throw new Error('arquivo indisponível');
        const { cutoffHz } = await QualityAnalyzer.analyzeArrayBuffer(await response.arrayBuffer());
        const avgKbps = (file.size * 8) / duration / 1000;
        const result = QualityAnalyzer.classify({ cutoffHz, avgKbps, ext: file.ext });

        let advice;
        if (result.suspicious) {
            advice = result.lossless
                ? t('quality.advice.suspiciousLossless')
                : t('quality.advice.suspiciousKbps', { kbps: Math.round(avgKbps) });
        } else {
            advice = t(`quality.advice.${result.level}`);
        }

        return {
            level: result.level,
            suspicious: result.suspicious,
            badgeClass: result.suspicious ? 'muito-baixa' : result.level,
            badgeText: result.suspicious ? t('quality.badge.suspicious') : t(`quality.badge.${result.level}`),
            detail: t('quality.detail', { kbps: Math.round(avgKbps), khz: I18n.formatNumber(cutoffHz / 1000, 1), advice })
        };
    }

    async function scanCofreQuality() {
        if (qualityScanRunning) return;
        qualityScanRunning = true;
        qualityList.innerHTML = '';
        qualitySummary.textContent = t('quality.searching');

        try {
            const data = await fetchJson('/quality/files');

            if (data.files.length === 0) {
                qualitySummary.textContent = t('quality.empty');
                return;
            }

            const items = data.files.map(file => {
                const li = document.createElement('li');
                li.className = 'quality-item';
                li.innerHTML = '<div class="quality-row"><span class="quality-name"></span><span class="quality-badge">...</span></div><div class="quality-detail"></div>';
                li.querySelector('.quality-name').textContent = file.name;
                li.querySelector('.quality-name').title = file.name;
                li.querySelector('.quality-detail').textContent = t('quality.waiting');
                qualityList.appendChild(li);
                return li;
            });

            const counts = { alta: 0, media: 0, baixa: 0, 'muito-baixa': 0, suspeitas: 0, outras: 0 };
            for (let i = 0; i < data.files.length; i++) {
                qualitySummary.textContent = t('quality.analyzingN', { current: i + 1, total: data.files.length });
                renderQualityItem(items[i], { badgeClass: '', badgeText: '...', detail: t('quality.analyzingItem') });
                try {
                    const result = await analyzeCofreFile(data.files[i]);
                    renderQualityItem(items[i], result);
                    if (result.level) counts[result.level]++;
                    else counts.outras++;
                    if (result.suspicious) counts.suspeitas++;
                } catch (e) {
                    counts.outras++;
                    console.error('Falha ao analisar', data.files[i].name, e);
                    renderQualityItem(items[i], { badgeClass: 'erro', badgeText: t('quality.badge.error'), detail: t('quality.unsupported') });
                }
            }

            const weak = counts.baixa + counts['muito-baixa'];
            const totals = { total: data.files.length, high: counts.alta, mid: counts.media, low: weak };
            qualitySummary.textContent = t('quality.summary', totals) +
                (counts.suspeitas ? t('quality.summarySuspicious', { count: counts.suspeitas }) : '') +
                (counts.outras ? t('quality.summaryOthers', { count: counts.outras }) : '') + '.';
            addLog(t('log.qualitySummary', totals) +
                (counts.suspeitas ? t('log.qualitySuspicious', { count: counts.suspeitas }) : '') + '.',
                weak || counts.suspeitas ? '#ffb86c' : 'var(--accent-green)');
        } catch (e) {
            qualitySummary.textContent = t('quality.failed', { message: e.message });
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
