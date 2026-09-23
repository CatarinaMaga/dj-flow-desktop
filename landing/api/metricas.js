// Devolve os números para o painel do app. Protegido por um token guardado
// como variável de ambiente na Vercel (METRICAS_TOKEN) — sem ele, responde 401.
const { resumo, configurado } = require('../lib/contador');

module.exports = async (req, res) => {
    const esperado = process.env.METRICAS_TOKEN;
    const recebido = String(req.query.token || req.headers['x-metricas-token'] || '');

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (!esperado) {
        return res.status(503).json({ erro: 'METRICAS_TOKEN ainda não foi definido nas variáveis de ambiente.' });
    }
    if (recebido !== esperado) {
        return res.status(401).json({ erro: 'token inválido' });
    }
    if (!configurado()) {
        return res.status(200).json({ configurado: false, aviso: 'banco de dados ainda não conectado ao projeto' });
    }

    const dias = Math.min(90, Math.max(1, parseInt(req.query.dias, 10) || 30));
    try {
        res.status(200).json(await resumo(dias));
    } catch (e) {
        res.status(500).json({ erro: e.message });
    }
};
