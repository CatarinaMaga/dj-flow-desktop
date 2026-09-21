// Painel da criadora: números de distribuição do DJ Flow.
//
// Abre com Ctrl+Shift+D e não aparece em lugar nenhum da interface. Os dados de
// download vêm da API pública de releases do GitHub, que só informa o total
// acumulado por arquivo — não existe histórico. Por isso o painel guarda uma
// foto por dia no próprio computador (localStorage) e monta a curva a partir
// dessas fotos: a linha começa no dia em que o painel for aberto pela primeira
// vez e vai crescendo a cada dia que ele for consultado.
(function (root) {
    const { t } = root.I18n;

    const REPO_PADRAO = 'CatarinaMaga/dj-flow-desktop';
    const METRICAS_PADRAO = 'https://djflow-pro.vercel.app/api/metricas';
    const CHAVE_HISTORICO = 'djflow_painel_historico_v1';
    const CHAVE_TOKEN = 'djflow_painel_token_github';
    const CHAVE_REPO = 'djflow_painel_repo';
    const CHAVE_METRICAS_URL = 'djflow_painel_metricas_url';
    const CHAVE_METRICAS_TOKEN = 'djflow_painel_metricas_token';
    const MAX_FOTOS = 400;

    let overlay = null;
    let carregando = false;

    // ── armazenamento local ──────────────────────────────────────────────────
    function lerHistorico() {
        try {
            const salvo = JSON.parse(localStorage.getItem(CHAVE_HISTORICO) || '[]');
            return Array.isArray(salvo) ? salvo : [];
        } catch (e) {
            return [];
        }
    }

    function guardarFoto(total, porVersao) {
        const hoje = new Date().toISOString().slice(0, 10);
        const historico = lerHistorico().filter(f => f.data !== hoje);
        historico.push({ data: hoje, total, porVersao });
        historico.sort((a, b) => a.data.localeCompare(b.data));
        try {
            localStorage.setItem(CHAVE_HISTORICO, JSON.stringify(historico.slice(-MAX_FOTOS)));
        } catch (e) {
            console.warn('Não foi possível guardar a foto do dia:', e);
        }
        return historico;
    }

    // ── dados ────────────────────────────────────────────────────────────────
    async function buscarReleases() {
        const repo = localStorage.getItem(CHAVE_REPO) || REPO_PADRAO;
        const token = localStorage.getItem(CHAVE_TOKEN);
        const headers = { Accept: 'application/vnd.github+json' };
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=100`, { headers });
        if (!res.ok) {
            const motivo = res.status === 403 ? t('painel.erroLimite') : `HTTP ${res.status}`;
            throw new Error(motivo);
        }
        const releases = await res.json();

        const versoes = releases.map(r => {
            const instalador = r.assets.filter(a => /Setup/i.test(a.name)).reduce((s, a) => s + a.download_count, 0);
            const portatil = r.assets.filter(a => !/Setup/i.test(a.name) && /\.exe$/i.test(a.name)).reduce((s, a) => s + a.download_count, 0);
            return {
                versao: r.tag_name,
                publicada: r.published_at,
                instalador,
                portatil,
                total: instalador + portatil
            };
        });
        versoes.sort((a, b) => String(a.publicada).localeCompare(String(b.publicada)));
        return versoes;
    }

    // Números da landing: vêm do contador da própria página, na Vercel. O token
    // fica só neste computador — o código não carrega segredo nenhum.
    async function buscarLanding() {
        const token = localStorage.getItem(CHAVE_METRICAS_TOKEN);
        if (!token) return { estado: 'sem-token' };
        const base = localStorage.getItem(CHAVE_METRICAS_URL) || METRICAS_PADRAO;
        try {
            const res = await fetch(`${base}?dias=30&token=${encodeURIComponent(token)}`);
            if (res.status === 401) return { estado: 'token-invalido' };
            if (!res.ok) return { estado: 'erro', motivo: `HTTP ${res.status}` };
            const dados = await res.json();
            if (!dados.configurado) return { estado: 'sem-banco' };
            return { estado: 'ok', dados };
        } catch (e) {
            return { estado: 'erro', motivo: e.message };
        }
    }

    // ── desenho dos gráficos ─────────────────────────────────────────────────
    function prepararCanvas(canvas) {
        const escala = window.devicePixelRatio || 1;
        const largura = canvas.clientWidth;
        const altura = canvas.clientHeight;
        canvas.width = largura * escala;
        canvas.height = altura * escala;
        const ctx = canvas.getContext('2d');
        ctx.setTransform(escala, 0, 0, escala, 0, 0);
        ctx.clearRect(0, 0, largura, altura);
        return { ctx, largura, altura };
    }

    function desenharEixos(ctx, largura, altura, margem, maximo, rotulos) {
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.fillStyle = 'rgba(235,238,245,0.45)';
        ctx.font = '11px Inter, sans-serif';
        ctx.lineWidth = 1;

        const linhas = 4;
        for (let i = 0; i <= linhas; i++) {
            const valor = Math.round((maximo / linhas) * i);
            const y = altura - margem.baixo - ((altura - margem.cima - margem.baixo) * i) / linhas;
            ctx.beginPath();
            ctx.moveTo(margem.esquerda, y);
            ctx.lineTo(largura - margem.direita, y);
            ctx.stroke();
            ctx.textAlign = 'right';
            ctx.fillText(I18n.formatNumber(valor), margem.esquerda - 8, y + 4);
        }

        ctx.textAlign = 'center';
        const passo = Math.max(1, Math.ceil(rotulos.length / 6));
        rotulos.forEach((rotulo, i) => {
            if (i % passo !== 0 && i !== rotulos.length - 1) return;
            const x = margem.esquerda + ((largura - margem.esquerda - margem.direita) * i) / Math.max(1, rotulos.length - 1);
            ctx.fillText(rotulo, x, altura - margem.baixo + 18);
        });
    }

    function desenharLinha(canvas, pontos) {
        const { ctx, largura, altura } = prepararCanvas(canvas);
        const margem = { cima: 16, baixo: 28, esquerda: 44, direita: 16 };
        if (pontos.length === 0) return;

        const maximo = Math.max(4, ...pontos.map(p => p.valor));
        const rotulos = pontos.map(p => I18n.formatDate(new Date(p.data + 'T12:00:00'), { curto: true }));
        desenharEixos(ctx, largura, altura, margem, maximo, rotulos);

        const x = (i) => margem.esquerda + ((largura - margem.esquerda - margem.direita) * i) / Math.max(1, pontos.length - 1);
        const y = (v) => altura - margem.baixo - ((altura - margem.cima - margem.baixo) * v) / maximo;

        // área sob a linha
        const gradiente = ctx.createLinearGradient(0, margem.cima, 0, altura - margem.baixo);
        gradiente.addColorStop(0, 'rgba(122,162,247,0.35)');
        gradiente.addColorStop(1, 'rgba(122,162,247,0)');
        ctx.beginPath();
        ctx.moveTo(x(0), altura - margem.baixo);
        pontos.forEach((p, i) => ctx.lineTo(x(i), y(p.valor)));
        ctx.lineTo(x(pontos.length - 1), altura - margem.baixo);
        ctx.closePath();
        ctx.fillStyle = gradiente;
        ctx.fill();

        ctx.beginPath();
        pontos.forEach((p, i) => (i === 0 ? ctx.moveTo(x(i), y(p.valor)) : ctx.lineTo(x(i), y(p.valor))));
        ctx.strokeStyle = '#7aa2f7';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.fillStyle = '#7aa2f7';
        pontos.forEach((p, i) => {
            ctx.beginPath();
            ctx.arc(x(i), y(p.valor), 3.5, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    // duas séries no mesmo gráfico: quem visitou e quem baixou
    function desenharLinhaDupla(canvas, series) {
        const { ctx, largura, altura } = prepararCanvas(canvas);
        const margem = { cima: 16, baixo: 28, esquerda: 44, direita: 16 };
        const dias = series[0].pontos;
        if (!dias || dias.length === 0) return;

        const maximo = Math.max(4, ...series.flatMap(s => s.pontos.map(p => p.valor)));
        const rotulos = dias.map(p => I18n.formatDate(new Date(p.data + 'T12:00:00'), { curto: true }));
        desenharEixos(ctx, largura, altura, margem, maximo, rotulos);

        const x = (i) => margem.esquerda + ((largura - margem.esquerda - margem.direita) * i) / Math.max(1, dias.length - 1);
        const y = (v) => altura - margem.baixo - ((altura - margem.cima - margem.baixo) * v) / maximo;

        series.forEach(serie => {
            ctx.beginPath();
            serie.pontos.forEach((p, i) => (i === 0 ? ctx.moveTo(x(i), y(p.valor)) : ctx.lineTo(x(i), y(p.valor))));
            ctx.strokeStyle = serie.cor;
            ctx.lineWidth = 2.5;
            ctx.stroke();
            ctx.fillStyle = serie.cor;
            serie.pontos.forEach((p, i) => {
                ctx.beginPath();
                ctx.arc(x(i), y(p.valor), 3, 0, Math.PI * 2);
                ctx.fill();
            });
        });
    }

    function desenharBarras(canvas, itens) {
        const { ctx, largura, altura } = prepararCanvas(canvas);
        const margem = { cima: 16, baixo: 28, esquerda: 44, direita: 16 };
        if (itens.length === 0) return;

        const maximo = Math.max(4, ...itens.map(i => i.instalador + i.portatil));
        desenharEixos(ctx, largura, altura, margem, maximo, itens.map(i => i.versao));

        const area = largura - margem.esquerda - margem.direita;
        const passo = area / itens.length;
        const larguraBarra = Math.min(46, passo * 0.6);
        const alturaUtil = altura - margem.cima - margem.baixo;

        itens.forEach((item, i) => {
            const centro = margem.esquerda + passo * (i + 0.5);
            const alturaInst = (alturaUtil * item.instalador) / maximo;
            const alturaPort = (alturaUtil * item.portatil) / maximo;
            const base = altura - margem.baixo;

            ctx.fillStyle = '#7aa2f7';
            ctx.fillRect(centro - larguraBarra / 2, base - alturaInst, larguraBarra, alturaInst);
            ctx.fillStyle = '#bb9af7';
            ctx.fillRect(centro - larguraBarra / 2, base - alturaInst - alturaPort, larguraBarra, alturaPort);
        });
    }

    // ── interface ────────────────────────────────────────────────────────────
    function criarOverlay() {
        const el = document.createElement('div');
        el.id = 'painel-overlay';
        el.className = 'painel-overlay';
        el.innerHTML = `
            <div class="painel-card">
                <div class="painel-head">
                    <h2 id="painel-titulo"></h2>
                    <button id="painel-fechar" class="painel-fechar" aria-label="x">✕</button>
                </div>
                <div id="painel-cartoes" class="painel-cartoes"></div>
                <div class="painel-grafico">
                    <div class="painel-legenda"><span id="painel-lbl-linha"></span></div>
                    <canvas id="painel-linha"></canvas>
                    <p id="painel-nota-linha" class="painel-nota"></p>
                </div>
                <div class="painel-grafico">
                    <div class="painel-legenda">
                        <span id="painel-lbl-barras"></span>
                        <span class="painel-chave"><i class="ponto azul"></i><span id="painel-lbl-inst"></span></span>
                        <span class="painel-chave"><i class="ponto roxo"></i><span id="painel-lbl-port"></span></span>
                    </div>
                    <canvas id="painel-barras"></canvas>
                </div>
                <div class="painel-grafico">
                    <div class="painel-legenda">
                        <span id="painel-lbl-landing"></span>
                        <span class="painel-chave"><i class="ponto verde"></i><span id="painel-lbl-visitantes"></span></span>
                        <span class="painel-chave"><i class="ponto azul"></i><span id="painel-lbl-baixaram"></span></span>
                    </div>
                    <div id="painel-landing-cartoes" class="painel-cartoes painel-cartoes-3"></div>
                    <canvas id="painel-landing"></canvas>
                    <p id="painel-landing-nota" class="painel-nota"></p>
                    <div id="painel-landing-form" class="painel-conectar" hidden>
                        <input id="painel-landing-token" type="password" autocomplete="off" />
                        <button id="painel-landing-salvar" class="painel-botao"></button>
                    </div>
                </div>
                <div class="painel-rodape">
                    <span id="painel-atualizado"></span>
                    <button id="painel-recarregar" class="painel-botao"></button>
                </div>
            </div>`;
        document.body.appendChild(el);

        el.querySelector('#painel-fechar').addEventListener('click', fechar);
        el.querySelector('#painel-recarregar').addEventListener('click', () => carregar(true));
        el.querySelector('#painel-landing-salvar').addEventListener('click', () => {
            const campo = el.querySelector('#painel-landing-token');
            const valor = campo.value.trim();
            if (valor) localStorage.setItem(CHAVE_METRICAS_TOKEN, valor);
            else localStorage.removeItem(CHAVE_METRICAS_TOKEN);
            campo.value = '';
            carregar(true);
        });
        el.addEventListener('click', (e) => { if (e.target === el) fechar(); });
        return el;
    }

    function textos() {
        overlay.querySelector('#painel-titulo').textContent = t('painel.titulo');
        overlay.querySelector('#painel-lbl-linha').textContent = t('painel.tituloLinha');
        overlay.querySelector('#painel-lbl-barras').textContent = t('painel.tituloBarras');
        overlay.querySelector('#painel-lbl-inst').textContent = t('painel.instalador');
        overlay.querySelector('#painel-lbl-port').textContent = t('painel.portatil');
        overlay.querySelector('#painel-recarregar').textContent = t('painel.recarregar');
        overlay.querySelector('#painel-lbl-landing').textContent = t('painel.tituloLanding');
        overlay.querySelector('#painel-lbl-visitantes').textContent = t('painel.visitantes');
        overlay.querySelector('#painel-lbl-baixaram').textContent = t('painel.baixaram');
        overlay.querySelector('#painel-landing-token').placeholder = t('painel.tokenPlaceholder');
        overlay.querySelector('#painel-landing-salvar').textContent = t('painel.salvar');
    }

    function preencherLanding(resposta) {
        const cartoes = overlay.querySelector('#painel-landing-cartoes');
        const nota = overlay.querySelector('#painel-landing-nota');
        const form = overlay.querySelector('#painel-landing-form');
        const canvas = overlay.querySelector('#painel-landing');
        cartoes.innerHTML = '';

        if (resposta.estado !== 'ok') {
            canvas.style.display = 'none';
            form.hidden = resposta.estado === 'sem-banco';
            nota.textContent = {
                'sem-token': t('painel.landingSemToken'),
                'token-invalido': t('painel.landingTokenInvalido'),
                'sem-banco': t('painel.landingSemBanco'),
                'erro': t('painel.landingErro', { motivo: resposta.motivo || '' })
            }[resposta.estado];
            return;
        }

        canvas.style.display = 'block';
        form.hidden = true;
        const serie = resposta.dados.serie;
        const hoje = serie[serie.length - 1] || { visitas: 0, visitantes: 0, baixaram: 0 };
        const sete = serie.slice(-7);
        const soma = (campo) => sete.reduce((s, d) => s + d[campo], 0);

        cartoes.append(
            cartao(t('painel.cartaoVisitantesHoje'), I18n.formatNumber(hoje.visitantes),
                t('painel.deVisitas', { n: I18n.formatNumber(hoje.visitas) })),
            cartao(t('painel.cartaoVisitantes7'), I18n.formatNumber(soma('visitantes'))),
            cartao(t('painel.cartaoBaixaram7'), I18n.formatNumber(soma('baixaram')))
        );

        desenharLinhaDupla(canvas, [
            { cor: '#50dc8c', pontos: serie.map(d => ({ data: d.data, valor: d.visitantes })) },
            { cor: '#7aa2f7', pontos: serie.map(d => ({ data: d.data, valor: d.baixaram })) }
        ]);

        const origens = Object.entries(resposta.dados.origensHoje || {})
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(([nome, n]) => `${nome} (${n})`)
            .join(' · ');
        nota.textContent = origens ? t('painel.origensHoje', { lista: origens }) : t('painel.landingOk');
    }

    function cartao(rotulo, valor, detalhe) {
        const div = document.createElement('div');
        div.className = 'painel-cartao';
        const v = document.createElement('strong');
        v.textContent = valor;
        const r = document.createElement('span');
        r.textContent = rotulo;
        div.append(v, r);
        if (detalhe) {
            const d = document.createElement('em');
            d.textContent = detalhe;
            div.append(d);
        }
        return div;
    }

    function preencher(versoes, historico) {
        const total = versoes.reduce((s, v) => s + v.total, 0);
        const cartoes = overlay.querySelector('#painel-cartoes');
        cartoes.innerHTML = '';

        // variação: compara a foto de hoje com a mais antiga dentro de 7 dias
        const limite = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
        const anteriores = historico.filter(f => f.data <= limite);
        const base = anteriores.length ? anteriores[anteriores.length - 1] : null;
        const variacao = base ? total - base.total : null;

        const maisBaixada = versoes.slice().sort((a, b) => b.total - a.total)[0];
        const ultima = versoes[versoes.length - 1];

        cartoes.append(
            cartao(t('painel.cartaoTotal'), I18n.formatNumber(total)),
            cartao(
                t('painel.cartaoSemana'),
                variacao === null ? '—' : (variacao > 0 ? '+' : '') + I18n.formatNumber(variacao),
                variacao === null ? t('painel.semBase') : ''
            ),
            cartao(t('painel.cartaoTop'), maisBaixada ? maisBaixada.versao : '—',
                maisBaixada ? t('painel.downloads', { n: I18n.formatNumber(maisBaixada.total) }) : ''),
            cartao(t('painel.cartaoUltima'), ultima ? ultima.versao : '—',
                ultima ? I18n.formatDate(new Date(ultima.publicada)) : '')
        );

        const pontos = historico.map(f => ({ data: f.data, valor: f.total }));
        desenharLinha(overlay.querySelector('#painel-linha'), pontos);
        overlay.querySelector('#painel-nota-linha').textContent =
            pontos.length < 2 ? t('painel.notaLinhaCurta') : t('painel.notaLinha');

        desenharBarras(overlay.querySelector('#painel-barras'), versoes);

        overlay.querySelector('#painel-atualizado').textContent =
            t('painel.atualizado', { hora: I18n.formatTime(new Date()) });
    }

    async function carregar(forcar) {
        if (carregando) return;
        carregando = true;
        const rodape = overlay.querySelector('#painel-atualizado');
        rodape.textContent = t('painel.carregando');
        buscarLanding().then(preencherLanding);
        try {
            const versoes = await buscarReleases();
            const total = versoes.reduce((s, v) => s + v.total, 0);
            const porVersao = {};
            versoes.forEach(v => { porVersao[v.versao] = v.total; });
            const historico = guardarFoto(total, porVersao);
            preencher(versoes, historico);
        } catch (e) {
            rodape.textContent = t('painel.erro', { motivo: e.message });
            const historico = lerHistorico();
            if (historico.length) {
                desenharLinha(overlay.querySelector('#painel-linha'), historico.map(f => ({ data: f.data, valor: f.total })));
            }
        } finally {
            carregando = false;
        }
    }

    function abrir() {
        if (!overlay) overlay = criarOverlay();
        textos();
        overlay.style.display = 'flex';
        carregar(false);
    }

    function fechar() {
        if (overlay) overlay.style.display = 'none';
    }

    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
            e.preventDefault();
            if (overlay && overlay.style.display === 'flex') fechar(); else abrir();
        }
        if (e.key === 'Escape' && overlay && overlay.style.display === 'flex') fechar();
    });

    root.PainelCriadora = {
        abrir,
        fechar,
        // Guardar um token do GitHub é opcional: só serve para subir o limite de
        // consultas da API. Fica no computador de quem digitou, nunca no código.
        definirToken(token) {
            if (token) localStorage.setItem(CHAVE_TOKEN, token);
            else localStorage.removeItem(CHAVE_TOKEN);
        },
        definirRepo(repo) {
            if (repo) localStorage.setItem(CHAVE_REPO, repo);
            else localStorage.removeItem(CHAVE_REPO);
        },
        // token do contador da landing; também dá pra digitar dentro do painel
        definirMetricas(token, url) {
            if (token) localStorage.setItem(CHAVE_METRICAS_TOKEN, token);
            else localStorage.removeItem(CHAVE_METRICAS_TOKEN);
            if (url) localStorage.setItem(CHAVE_METRICAS_URL, url);
        },
        exportarHistorico: lerHistorico
    };
})(window);
