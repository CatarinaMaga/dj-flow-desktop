// Registra uma visita na landing. A página chama este endereço uma vez por
// carregamento; nada é gravado no navegador de quem visita.
const { registrar } = require('../lib/contador');

module.exports = async (req, res) => {
    try {
        await registrar('v', req, null);
    } catch (e) {
        console.error('falha ao registrar visita:', e.message);
    }
    res.setHeader('Cache-Control', 'no-store');
    res.status(204).end();
};
