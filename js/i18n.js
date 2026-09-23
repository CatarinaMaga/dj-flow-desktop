(function (root) {
    const STORAGE_KEY = 'djflow_lang';
    const SUPPORTED = ['pt', 'en'];

    const messages = {
        pt: {
            'lang.label': 'Idioma',

            'terms.title': 'Termos de Uso',
            'terms.intro': 'O DJ Flow é uma ferramenta de <strong>produtividade para organização de biblioteca musical</strong>.',
            'terms.declare': 'Ao utilizar este aplicativo, você declara que:',
            'terms.item1': '✅ Só irá baixar conteúdo que possui <strong>direito legal de uso</strong> (comprado, licenciado, domínio público ou autorizado pelo autor).',
            'terms.item2': '✅ Não usará o app para fins de pirataria ou distribuição não autorizada.',
            'terms.item3': '✅ É o único responsável pelo uso que faz do conteúdo baixado.',
            'terms.note': 'Este software não armazena, distribui nem reproduz conteúdo de terceiros. O download é feito localmente no seu computador.',
            'terms.accept': '✅ Li e Aceito os Termos',
            'terms.reject': '❌ Não Aceito — Fechar',

            'main.linkLabel': 'Link da Faixa:',
            'main.placeholder': 'Cole um link ou vários separados por espaço...',
            'main.linkHint': 'Vários links de uma vez? Separe cada um com um espaço. O link de uma playlist ou álbum também funciona sozinho.',

            // Painel da criadora (Ctrl+Shift+D)
            'painel.titulo': 'Painel da criadora',
            'painel.tituloLinha': 'Downloads acumulados',
            'painel.tituloBarras': 'Downloads por versão',
            'painel.instalador': 'instalador',
            'painel.portatil': 'portátil',
            'painel.cartaoTotal': 'downloads no total',
            'painel.cartaoSemana': 'nos últimos 7 dias',
            'painel.cartaoTop': 'versão mais baixada',
            'painel.cartaoUltima': 'última publicada',
            'painel.downloads': '{n} downloads',
            'painel.semBase': 'ainda sem 7 dias de histórico',
            'painel.notaLinha': 'A curva é montada com uma foto por dia, guardada neste computador.',
            'painel.notaLinhaCurta': 'A curva começa hoje: o GitHub só informa o total acumulado, então o painel guarda uma foto por dia daqui pra frente.',
            'painel.atualizado': 'atualizado às {hora}',
            'painel.carregando': 'consultando o GitHub...',
            'painel.recarregar': 'Atualizar',
            'painel.erro': 'não deu pra consultar o GitHub: {motivo}',
            'painel.erroLimite': 'limite de consultas do GitHub atingido, tente daqui a pouco',
            'painel.tituloLanding': 'Landing',
            'painel.visitantes': 'visitantes',
            'painel.baixaram': 'baixaram',
            'painel.cartaoVisitantesHoje': 'visitantes hoje',
            'painel.cartaoVisitantes7': 'visitantes em 7 dias',
            'painel.cartaoBaixaram7': 'baixaram em 7 dias',
            'painel.deVisitas': 'de {n} visitas',
            'painel.origensHoje': 'de onde vieram hoje: {lista}',
            'painel.canaisHoje': 'por rede hoje: {lista}',
            'painel.landingOk': 'Visitantes e downloads contados na própria landing, sem cookie e sem guardar IP.',
            'painel.landingSemToken': 'Cole aqui o token do contador da landing para ver visitantes e downloads.',
            'painel.landingTokenInvalido': 'O token do contador não foi aceito. Confira o valor gravado na Vercel.',
            'painel.landingSemBanco': 'O contador está no ar, mas o banco de dados ainda não foi conectado ao projeto na Vercel.',
            'painel.landingErro': 'não deu pra falar com o contador da landing: {motivo}',
            'painel.tokenPlaceholder': 'token do contador',
            'painel.salvar': 'Salvar',
            'main.downloadMany': '<span class="icon">⬇</span> Baixar {count} faixas',
            'main.linksDetected': '{count} links detectados',
            'queue.title': 'Fila de download',
            'queue.titleProgress': 'Fila: {current} de {total}',
            'queue.stop': 'Parar',
            'queue.pending': 'na fila',
            'queue.downloading': 'baixando...',
            'queue.done': 'pronto',
            'queue.error': 'erro',
            'queue.skipped': 'cancelado',
            'log.queueStart': '🚀 Baixando {count} faixas...',
            'log.queueDone': '✅ Fila concluída: {done} baixadas, {failed} com erro.',
            'log.queueStopped': '⏹️ Fila interrompida: {done} baixadas, {left} não baixadas.',
            'log.expanding': '🔍 Procurando as faixas do link...',
            'main.previewTitle': 'Título do vídeo',
            'main.download': '<span class="icon">⬇</span> Baixar para o Cofre',
            'main.downloading': '<span class="icon">⏳</span> Salvando no Cofre...',
            'main.openVault': '📁 Abrir Cofre',
            'main.quality': '🎚️ Qualidade',
            'main.qualityHint': 'Confere a qualidade real de cada faixa do Cofre',
            'main.updateEngine': '🔄 Atualizar Motor de Download',
            'main.updateEngineHint': 'Atualiza o yt-dlp caso os downloads parem de funcionar',
            'main.checking': '<span class="icon">⏳</span> Verificando...',
            'main.helper': '<strong>Rekordbox:</strong> importe a pasta <span class="helper-path">Músicas / Cofre DJ Flow</span>',

            'log.title': 'Registro de Atividade',
            'log.empty': 'Aguardando entrada de link...',
            'log.analyzingLink': '🔍 Analisando link...',
            'log.ready': '⭐ Pronto: {title}',
            'log.error': '❌ ERRO: {message}',
            'log.downloadStart': '🚀 Iniciando download...',
            'log.saved': '✅ "{title}" salvo no Cofre!',
            'log.fileFallback': 'Arquivo',
            'log.folderError': '❌ Não foi possível abrir a pasta.',
            'log.engineChecking': '🔄 Verificando atualização do motor de download...',
            'log.engineUpdated': '✅ Motor de download atualizado para a versão de {date}.',
            'log.engineUpToDate': '✅ Motor de download em dia: versão de {date} (verificado em {today}).',
            'log.engineChecked': '✅ Verificação do motor de download concluída em {today}.',
            'log.engineError': '❌ ERRO ao atualizar motor: {message}',
            'log.updateAvailable': '⬆️ Nova versão disponível: v{version}.',
            'update.banner': 'Versão {version} disponível',
            'update.action': 'Atualizar',
            'log.updateDownload': 'Baixar',
            'log.qualitySummary': '🎚️ Qualidade do Cofre: {high} alta, {mid} média, {low} baixa',
            'log.qualitySuspicious': ', {count} suspeita(s)',

            'errors.bad_format': 'O servidor local retornou um formato inesperado. Verifique se há outro programa usando a porta 3891.',
            'errors.engine_unreachable': 'Erro de comunicação com o motor (porta 3891 ocupada).',
            'errors.unauthorized': 'Acesso não autorizado ao backend do DJ Flow.',
            'errors.route_not_found': 'Rota não encontrada no backend do DJ Flow.',
            'errors.invalid_url': 'URL inválida ou fonte não suportada. Use YouTube, SoundCloud, Bandcamp ou Archive.org.',
            'errors.vault_not_ready': 'O Cofre ainda não foi inicializado. Aguarde um momento e tente novamente.',
            'errors.download_failed': 'Falha durante o download. Tente atualizar o motor de download.',
            'errors.track_unavailable': 'Faixa indisponível ou link inválido.',
            'errors.engine_update_failed': 'Não foi possível verificar atualizações do motor de download.',
            'errors.file_not_found': 'Arquivo não encontrado no Cofre.',

            'quality.title': 'Qualidade do Cofre',
            'quality.close': 'Fechar',
            'quality.searching': 'Procurando faixas...',
            'quality.note': 'Estimativa pelos agudos da faixa: arquivos fracos, como os do YouTube, perdem tudo acima de ~16 kHz.',
            'quality.empty': 'Nenhum arquivo de áudio no Cofre ainda.',
            'quality.waiting': 'Aguardando análise',
            'quality.analyzingN': 'Analisando {current} de {total}...',
            'quality.analyzingItem': 'Analisando os agudos da faixa...',
            'quality.unreadable': 'Não foi possível ler este arquivo.',
            'quality.long': 'Arquivo longo ({minutes} min), parece mix ou álbum inteiro.',
            'quality.unsupported': 'Formato não suportado ou arquivo corrompido.',
            'quality.failed': 'Não foi possível analisar o Cofre: {message}',
            'quality.detail': '~{kbps} kbps · agudos até {khz} kHz · {advice}',
            'quality.summary': '{total} faixas: {high} alta, {mid} média, {low} baixa',
            'quality.summarySuspicious': ', {count} suspeita(s) de conversão',
            'quality.summaryOthers': ', {count} pulada(s) ou com erro',
            'quality.badge.alta': 'Alta',
            'quality.badge.media': 'Média',
            'quality.badge.baixa': 'Baixa',
            'quality.badge.muito-baixa': 'Muito baixa',
            'quality.badge.suspicious': 'Suspeita',
            'quality.badge.error': 'Erro',
            'quality.badge.skipped': 'Pulada',
            'quality.advice.alta': 'Pronta pra tocar em som grande.',
            'quality.advice.media': 'Ok pra maioria dos sistemas de som.',
            'quality.advice.baixa': 'Pode soar abafada em som grande.',
            'quality.advice.muito-baixa': 'Evite tocar em som grande.',
            'quality.advice.suspiciousLossless': 'Diz ter qualidade sem perdas, mas foi feita a partir de um arquivo fraco.',
            'quality.advice.suspiciousKbps': 'Diz ter {kbps} kbps, mas foi feita a partir de um arquivo fraco.'
        },

        en: {
            'lang.label': 'Language',

            'terms.title': 'Terms of Use',
            'terms.intro': 'DJ Flow is a <strong>productivity tool for organizing your music library</strong>.',
            'terms.declare': 'By using this app, you declare that you:',
            'terms.item1': '✅ Will only download content you have the <strong>legal right to use</strong> (purchased, licensed, public domain or authorized by the author).',
            'terms.item2': '✅ Will not use the app for piracy or unauthorized distribution.',
            'terms.item3': '✅ Are solely responsible for how you use the downloaded content.',
            'terms.note': 'This software does not store, distribute or play third-party content. Downloads happen locally on your computer.',
            'terms.accept': '✅ I Have Read and Accept the Terms',
            'terms.reject': '❌ I Don\'t Accept — Close',

            'main.linkLabel': 'Track Link:',
            'main.placeholder': 'Paste one link, or several separated by spaces...',
            'main.linkHint': 'Several links at once? Separate each one with a space. A playlist or album link also works on its own.',

            // Creator dashboard (Ctrl+Shift+D)
            'painel.titulo': 'Creator dashboard',
            'painel.tituloLinha': 'Cumulative downloads',
            'painel.tituloBarras': 'Downloads per version',
            'painel.instalador': 'installer',
            'painel.portatil': 'portable',
            'painel.cartaoTotal': 'downloads in total',
            'painel.cartaoSemana': 'in the last 7 days',
            'painel.cartaoTop': 'most downloaded version',
            'painel.cartaoUltima': 'latest release',
            'painel.downloads': '{n} downloads',
            'painel.semBase': 'less than 7 days of history so far',
            'painel.notaLinha': 'The curve is built from one snapshot a day, kept on this computer.',
            'painel.notaLinhaCurta': 'The curve starts today: GitHub only reports running totals, so the dashboard saves one snapshot a day from now on.',
            'painel.atualizado': 'updated at {hora}',
            'painel.carregando': 'asking GitHub...',
            'painel.recarregar': 'Refresh',
            'painel.erro': 'could not reach GitHub: {motivo}',
            'painel.erroLimite': 'GitHub rate limit reached, try again shortly',
            'painel.tituloLanding': 'Landing page',
            'painel.visitantes': 'visitors',
            'painel.baixaram': 'downloaded',
            'painel.cartaoVisitantesHoje': 'visitors today',
            'painel.cartaoVisitantes7': 'visitors in 7 days',
            'painel.cartaoBaixaram7': 'downloaded in 7 days',
            'painel.deVisitas': 'out of {n} visits',
            'painel.origensHoje': 'where they came from today: {lista}',
            'painel.canaisHoje': 'by network today: {lista}',
            'painel.landingOk': 'Visitors and downloads counted on the landing page itself, with no cookies and no stored IP.',
            'painel.landingSemToken': 'Paste the landing counter token here to see visitors and downloads.',
            'painel.landingTokenInvalido': 'The counter token was rejected. Check the value stored on Vercel.',
            'painel.landingSemBanco': 'The counter is live, but the database is not connected to the Vercel project yet.',
            'painel.landingErro': 'could not reach the landing counter: {motivo}',
            'painel.tokenPlaceholder': 'counter token',
            'painel.salvar': 'Save',
            'main.downloadMany': '<span class="icon">⬇</span> Download {count} tracks',
            'main.linksDetected': '{count} links detected',
            'queue.title': 'Download queue',
            'queue.titleProgress': 'Queue: {current} of {total}',
            'queue.stop': 'Stop',
            'queue.pending': 'queued',
            'queue.downloading': 'downloading...',
            'queue.done': 'done',
            'queue.error': 'error',
            'queue.skipped': 'canceled',
            'log.queueStart': '🚀 Downloading {count} tracks...',
            'log.queueDone': '✅ Queue finished: {done} downloaded, {failed} failed.',
            'log.queueStopped': '⏹️ Queue stopped: {done} downloaded, {left} not downloaded.',
            'log.expanding': '🔍 Looking for the tracks in the link...',
            'main.previewTitle': 'Video title',
            'main.download': '<span class="icon">⬇</span> Download to Vault',
            'main.downloading': '<span class="icon">⏳</span> Saving to Vault...',
            'main.openVault': '📁 Open Vault',
            'main.quality': '🎚️ Quality',
            'main.qualityHint': 'Checks the real quality of every track in the Vault',
            'main.updateEngine': '🔄 Update Download Engine',
            'main.updateEngineHint': 'Updates yt-dlp in case downloads stop working',
            'main.checking': '<span class="icon">⏳</span> Checking...',
            'main.helper': '<strong>Rekordbox:</strong> import the folder <span class="helper-path">Music / Cofre DJ Flow</span>',

            'log.title': 'Activity Log',
            'log.empty': 'Waiting for a link...',
            'log.analyzingLink': '🔍 Checking link...',
            'log.ready': '⭐ Ready: {title}',
            'log.error': '❌ ERROR: {message}',
            'log.downloadStart': '🚀 Starting download...',
            'log.saved': '✅ "{title}" saved to the Vault!',
            'log.fileFallback': 'File',
            'log.folderError': '❌ Couldn\'t open the folder.',
            'log.engineChecking': '🔄 Checking for download engine updates...',
            'log.engineUpdated': '✅ Download engine updated to the {date} release.',
            'log.engineUpToDate': '✅ Download engine is up to date: {date} release (checked on {today}).',
            'log.engineChecked': '✅ Download engine check finished on {today}.',
            'log.engineError': '❌ ERROR updating the engine: {message}',
            'log.updateAvailable': '⬆️ New version available: v{version}.',
            'update.banner': 'Version {version} available',
            'update.action': 'Update',
            'log.updateDownload': 'Download',
            'log.qualitySummary': '🎚️ Vault quality: {high} high, {mid} medium, {low} low',
            'log.qualitySuspicious': ', {count} suspicious',

            'errors.bad_format': 'The local server returned an unexpected format. Check whether another program is using port 3891.',
            'errors.engine_unreachable': 'Couldn\'t reach the download engine (port 3891 is busy).',
            'errors.unauthorized': 'Unauthorized access to the DJ Flow backend.',
            'errors.route_not_found': 'Route not found in the DJ Flow backend.',
            'errors.invalid_url': 'Invalid URL or unsupported source. Use YouTube, SoundCloud, Bandcamp or Archive.org.',
            'errors.vault_not_ready': 'The Vault isn\'t ready yet. Wait a moment and try again.',
            'errors.download_failed': 'Download failed. Try updating the download engine.',
            'errors.track_unavailable': 'Track unavailable or invalid link.',
            'errors.engine_update_failed': 'Couldn\'t check for download engine updates.',
            'errors.file_not_found': 'File not found in the Vault.',

            'quality.title': 'Vault Quality',
            'quality.close': 'Close',
            'quality.searching': 'Looking for tracks...',
            'quality.note': 'Estimated from the track\'s high frequencies: weak files, like YouTube audio, lose everything above ~16 kHz.',
            'quality.empty': 'No audio files in the Vault yet.',
            'quality.waiting': 'Waiting',
            'quality.analyzingN': 'Analyzing {current} of {total}...',
            'quality.analyzingItem': 'Analyzing the track\'s high frequencies...',
            'quality.unreadable': 'Couldn\'t read this file.',
            'quality.long': 'Long file ({minutes} min), looks like a mix or full album.',
            'quality.unsupported': 'Unsupported format or corrupted file.',
            'quality.failed': 'Couldn\'t analyze the Vault: {message}',
            'quality.detail': '~{kbps} kbps · highs up to {khz} kHz · {advice}',
            'quality.summary': '{total} tracks: {high} high, {mid} medium, {low} low',
            'quality.summarySuspicious': ', {count} suspected transcode(s)',
            'quality.summaryOthers': ', {count} skipped or failed',
            'quality.badge.alta': 'High',
            'quality.badge.media': 'Medium',
            'quality.badge.baixa': 'Low',
            'quality.badge.muito-baixa': 'Very low',
            'quality.badge.suspicious': 'Suspicious',
            'quality.badge.error': 'Error',
            'quality.badge.skipped': 'Skipped',
            'quality.advice.alta': 'Ready for a big sound system.',
            'quality.advice.media': 'Fine for most sound systems.',
            'quality.advice.baixa': 'May sound muffled on a big sound system.',
            'quality.advice.muito-baixa': 'Avoid playing it on a big sound system.',
            'quality.advice.suspiciousLossless': 'Claims to be lossless, but was made from a weak file.',
            'quality.advice.suspiciousKbps': 'Claims to be {kbps} kbps, but was made from a weak file.'
        }
    };

    function detectLanguage() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (SUPPORTED.includes(saved)) return saved;
        } catch (e) {
            // localStorage indisponível: segue pelo idioma do sistema
        }
        // Só o idioma principal do sistema: navigator.languages costuma trazer
        // idiomas secundários (ex.: ["en-US", "pt-BR"]) que não são a escolha do usuário.
        const primary = (navigator.languages && navigator.languages[0]) || navigator.language || 'en';
        return String(primary).toLowerCase().startsWith('pt') ? 'pt' : 'en';
    }

    const lang = detectLanguage();
    const locale = lang === 'pt' ? 'pt-BR' : 'en-US';

    function t(key, vars = {}) {
        const template = messages[lang][key] ?? messages.pt[key] ?? key;
        return template.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
    }

    // Os textos com HTML (data-i18n-html) vêm só deste dicionário, nunca de
    // dados externos, então podem ir direto pro innerHTML.
    function apply(scope = document) {
        document.documentElement.lang = locale;
        scope.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
        scope.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
        scope.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
        scope.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
        scope.querySelectorAll('[data-i18n-aria-label]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel)); });
    }

    function setLanguage(newLang) {
        if (!SUPPORTED.includes(newLang)) return;
        localStorage.setItem(STORAGE_KEY, newLang);
    }

    function formatDate(date, { utc = false, curto = false } = {}) {
        // "curto" é usado nos eixos dos gráficos, onde o ano não cabe
        let options;
        if (curto) {
            options = lang === 'pt' ? { day: '2-digit', month: '2-digit' } : { month: 'short', day: 'numeric' };
        } else {
            options = lang === 'pt'
                ? { day: '2-digit', month: '2-digit', year: 'numeric' }
                : { month: 'short', day: 'numeric', year: 'numeric' };
        }
        if (utc) options.timeZone = 'UTC';
        return new Intl.DateTimeFormat(locale, options).format(date);
    }

    function formatNumber(value, fractionDigits) {
        return value.toLocaleString(locale, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits });
    }

    function formatTime(date) {
        return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    root.I18n = { lang, locale, t, apply, setLanguage, formatDate, formatNumber, formatTime, supported: SUPPORTED };
})(window);
