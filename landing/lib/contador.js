// Contagem de visitas e downloads da landing do DJ Flow.
//
// Regras que valem para os dois contadores:
// - nunca guardamos IP, nem e-mail, nem nada que identifique a pessoa;
// - para separar "pessoas diferentes" de "acessos", geramos uma etiqueta
//   diária: sha256(IP + navegador + data + segredo), cortada em 16 caracteres.
//   Ela muda todo dia e não tem volta, então serve para contar sem identificar;
// - robôs (buscadores, antivírus, pré-visualização de link) ficam de fora.
//
// O armazenamento é um Redis da Upstash conectado pela própria Vercel. Se ele
// ainda não estiver configurado, tudo continua funcionando: a contagem é
// ignorada e o download é redirecionado do mesmo jeito.

const crypto = require('crypto');

const ROBOS = /bot|crawl|spider|slurp|preview|monitor|curl|wget|headless|facebookexternalhit|whatsapp|telegram|discord|python-requests|axios/i;
const DIAS_GUARDADOS = 90;

function credenciais() {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    return url && token ? { url, token } : null;
}

function configurado() {
    return credenciais() !== null;
}

async function executar(comandos) {
    const cred = credenciais();
    if (!cred || comandos.length === 0) return null;
    const resposta = await fetch(`${cred.url}/pipeline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${cred.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(comandos)
    });
    if (!resposta.ok) throw new Error(`Redis respondeu ${resposta.status}`);
    const dados = await resposta.json();
    return dados.map(d => (d && Object.prototype.hasOwnProperty.call(d, 'result') ? d.result : null));
}

function hoje() {
    return new Date().toISOString().slice(0, 10);
}

function diasRecentes(quantidade) {
    const lista = [];
    const agora = Date.now();
    for (let i = quantidade - 1; i >= 0; i--) {
        lista.push(new Date(agora - i * 86400000).toISOString().slice(0, 10));
    }
    return lista;
}

function ehRobo(req) {
    const ua = String(req.headers['user-agent'] || '');
    return ua === '' || ROBOS.test(ua);
}

function etiqueta(req, data) {
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const ua = String(req.headers['user-agent'] || '');
    const segredo = process.env.HASH_SALT || 'djflow-sal-padrao';
    return crypto.createHash('sha256').update(`${ip}|${ua}|${data}|${segredo}`).digest('hex').slice(0, 16);
}

function origem(req) {
    const referer = String(req.headers.referer || req.headers.referrer || '');
    if (!referer) return 'direto';
    try {
        const host = new URL(referer).hostname.replace(/^www\./, '');
        if (host.endsWith('djflow-pro.vercel.app')) return 'interno';
        return host;
    } catch (e) {
        return 'direto';
    }
}

// prefixo 'v' para visitas na landing, 'd' para downloads do app
async function registrar(prefixo, req, extra) {
    if (!configurado() || ehRobo(req)) return;
    const data = hoje();
    const marca = etiqueta(req, data);
    const comandos = [
        ['INCR', `${prefixo}:total`],
        ['INCR', `${prefixo}:dia:${data}`],
        ['SADD', `${prefixo}:pessoas:${data}`, marca],
        ['EXPIRE', `${prefixo}:pessoas:${data}`, String(DIAS_GUARDADOS * 86400)],
        ['HINCRBY', `${prefixo}:origem:${data}`, origem(req), '1'],
        ['EXPIRE', `${prefixo}:origem:${data}`, String(DIAS_GUARDADOS * 86400)]
    ];
    if (extra) {
        comandos.push(['HINCRBY', `${prefixo}:botao:${data}`, extra, '1']);
        comandos.push(['EXPIRE', `${prefixo}:botao:${data}`, String(DIAS_GUARDADOS * 86400)]);
    }
    await executar(comandos);
}

async function resumo(dias) {
    if (!configurado()) return { configurado: false };
    const datas = diasRecentes(dias);
    const comandos = [['GET', 'v:total'], ['GET', 'd:total']];
    datas.forEach(data => {
        comandos.push(['GET', `v:dia:${data}`]);
        comandos.push(['SCARD', `v:pessoas:${data}`]);
        comandos.push(['GET', `d:dia:${data}`]);
        comandos.push(['SCARD', `d:pessoas:${data}`]);
    });
    comandos.push(['HGETALL', `v:origem:${hoje()}`]);
    comandos.push(['HGETALL', `v:botao:${hoje()}`]);
    const resultado = await executar(comandos);

    const numero = (v) => (v === null || v === undefined ? 0 : Number(v) || 0);
    const serie = datas.map((data, i) => {
        const base = 2 + i * 4;
        return {
            data,
            visitas: numero(resultado[base]),
            visitantes: numero(resultado[base + 1]),
            downloads: numero(resultado[base + 2]),
            baixaram: numero(resultado[base + 3])
        };
    });

    // HGETALL volta como lista alternando campo e valor
    function mapa(bruto) {
        const saida = {};
        if (Array.isArray(bruto)) {
            for (let i = 0; i < bruto.length; i += 2) saida[bruto[i]] = Number(bruto[i + 1]) || 0;
        } else if (bruto && typeof bruto === 'object') {
            Object.entries(bruto).forEach(([k, v]) => { saida[k] = Number(v) || 0; });
        }
        return saida;
    }
    const origens = mapa(resultado[resultado.length - 2]);
    const campanhas = mapa(resultado[resultado.length - 1]);

    return {
        configurado: true,
        geradoEm: new Date().toISOString(),
        totais: { visitas: numero(resultado[0]), downloads: numero(resultado[1]) },
        serie,
        origensHoje: origens,
        canaisHoje: campanhas
    };
}

module.exports = { registrar, resumo, configurado };
