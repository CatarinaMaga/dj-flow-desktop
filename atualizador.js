// Atualização de dentro do app.
//
// Quando o GitHub anuncia uma versão nova, o botão "Atualizar" baixa o
// instalador publicado naquele release, confere que o arquivo é exatamente o
// que foi publicado (tamanho e hash SHA-256 que o próprio GitHub informa) e o
// abre. O instalador substitui o app e abre a versão nova ao terminar.
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');

// O instalador só pode vir do GitHub. O link de download redireciona para os
// servidores de arquivos dele (*.githubusercontent.com).
function hostConfiavel(url) {
    const { protocol, hostname } = new URL(url);
    return protocol === 'https:' && (hostname === 'github.com' || hostname.endsWith('.githubusercontent.com'));
}

// Escolhe, entre os arquivos do release, o instalador (não a versão portátil).
function instaladorDoRelease(release) {
    const asset = (release.assets || []).find(a => /Setup.*\.exe$/i.test(a.name));
    if (!asset) return null;
    const digest = String(asset.digest || '');
    return {
        nome: asset.name,
        url: asset.browser_download_url,
        tamanho: asset.size || 0,
        sha256: digest.startsWith('sha256:') ? digest.slice(7).toLowerCase() : null
    };
}

function baixarArquivo(url, destino, aoProgredir, saltos = 0) {
    return new Promise((resolve, reject) => {
        if (!hostConfiavel(url)) {
            reject(new Error('endereço de download fora do GitHub'));
            return;
        }
        const req = https.get(url, { headers: { 'User-Agent': 'dj-flow-desktop' } }, (res) => {
            if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
                res.resume();
                if (saltos >= 5) {
                    reject(new Error('redirecionamentos demais'));
                    return;
                }
                resolve(baixarArquivo(new URL(res.headers.location, url).toString(), destino, aoProgredir, saltos + 1));
                return;
            }
            if (res.statusCode !== 200) {
                res.resume();
                reject(new Error(`o GitHub respondeu ${res.statusCode}`));
                return;
            }

            const total = Number(res.headers['content-length']) || 0;
            const hash = crypto.createHash('sha256');
            const arquivo = fs.createWriteStream(destino);
            let recebido = 0;
            res.on('data', (pedaco) => {
                recebido += pedaco.length;
                hash.update(pedaco);
                if (total && aoProgredir) aoProgredir(recebido / total);
            });
            res.on('error', reject);
            arquivo.on('error', reject);
            arquivo.on('finish', () => arquivo.close(() => resolve({ bytes: recebido, sha256: hash.digest('hex') })));
            res.pipe(arquivo);
        });
        req.on('error', reject);
        req.setTimeout(30000, () => req.destroy(new Error('a conexão parou de responder')));
    });
}

// Baixa e confere. Se qualquer verificação falhar, o arquivo é apagado: um
// instalador que não confere com o publicado nunca é aberto.
async function baixarInstalador(instalador, destino, aoProgredir) {
    const resultado = await baixarArquivo(instalador.url, destino, aoProgredir);
    const falha = (motivo) => {
        fs.rmSync(destino, { force: true });
        throw new Error(motivo);
    };
    if (instalador.tamanho && resultado.bytes !== instalador.tamanho) falha('o download veio incompleto');
    if (instalador.sha256 && resultado.sha256 !== instalador.sha256) falha('o arquivo baixado não confere com o publicado');
    return resultado;
}

module.exports = { instaladorDoRelease, baixarInstalador, hostConfiavel };
