// Conta o download e manda a pessoa para a página de releases do GitHub.
// O parâmetro ?de= diz qual botão da landing foi usado (hero, faq, rodapé...).
const { registrar } = require('../lib/contador');

const DESTINO = 'https://github.com/CatarinaMaga/dj-flow-desktop/releases/latest';
const BOTOES = ['hero', 'recursos', 'faq', 'rodape', 'pesquisa', 'outro'];

module.exports = async (req, res) => {
    const de = BOTOES.includes(String(req.query.de)) ? String(req.query.de) : 'outro';
    try {
        await registrar('d', req, de);
    } catch (e) {
        // contar nunca pode impedir o download
        console.error('falha ao registrar download:', e.message);
    }
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(302, DESTINO);
};
