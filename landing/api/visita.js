// Registra uma visita na landing. A página chama este endereço uma vez por
// carregamento; nada é gravado no navegador de quem visita.
const { registrar } = require('../lib/contador');

const CANAIS = ['tiktok', 'instagram', 'linkedin', 'whatsapp', 'youtube', 'x', 'outro'];

module.exports = async (req, res) => {
    // ?de=tiktok diz de qual rede a pessoa veio, mesmo quando o navegador
    // não manda o referer (é o caso do navegador interno do TikTok).
    const de = CANAIS.includes(String(req.query.de)) ? String(req.query.de) : null;
    try {
        await registrar('v', req, de);
    } catch (e) {
        console.error('falha ao registrar visita:', e.message);
    }
    res.setHeader('Cache-Control', 'no-store');
    res.status(204).end();
};
