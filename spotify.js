// Links do Spotify.
//
// O áudio do Spotify é protegido (DRM) e não pode ser baixado por ninguém. O que
// fazemos é ler o nome e o artista de cada faixa na página pública de
// incorporação — a mesma que o Spotify usa para pôr o player dentro de outros
// sites — e buscar o áudio no YouTube, escolhendo a versão cuja duração bate com
// a que o Spotify informa. Para funcionar, a playlist precisa ser pública ou ter
// link de compartilhamento.
const youtubedl = require('youtube-dl-exec');

const TIPOS = ['track', 'playlist', 'album'];
const AGENTE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function ehSpotify(url) {
    try {
        const host = new URL(url).hostname;
        return host === 'open.spotify.com' || host === 'spotify.link';
    } catch (e) {
        return false;
    }
}

// O app do celular compartilha links curtos (spotify.link/…) que redirecionam
// para open.spotify.com.
async function resolverLinkCurto(url) {
    if (new URL(url).hostname !== 'spotify.link') return url;
    const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': AGENTE } });
    return res.url;
}

function lerEntidade(url) {
    // /track/ID, /playlist/ID, /album/ID — às vezes com /intl-pt/ na frente
    const partes = new URL(url).pathname.split('/').filter(Boolean);
    const i = partes.findIndex(p => TIPOS.includes(p));
    if (i === -1 || !partes[i + 1]) return null;
    return { tipo: partes[i], id: partes[i + 1] };
}

async function buscarEntidade(tipo, id) {
    const res = await fetch(`https://open.spotify.com/embed/${tipo}/${id}`, { headers: { 'User-Agent': AGENTE } });
    if (!res.ok) throw new Error(`Spotify respondeu ${res.status}`);
    const html = await res.text();
    const bloco = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!bloco) throw new Error('página do Spotify sem dados');
    const entidade = JSON.parse(bloco[1])?.props?.pageProps?.state?.data?.entity;
    if (!entidade) throw new Error('o Spotify não devolveu a faixa');
    return entidade;
}

function capaDe(entidade) {
    const imagens = entidade?.visualIdentity?.image || entidade?.coverArt?.sources || [];
    const maior = [...imagens].sort((a, b) => (b.maxWidth || b.width || 0) - (a.maxWidth || a.width || 0))[0];
    return maior?.url || '';
}

// Os nomes de artista da lista vêm separados por vírgula + espaço não separável.
function limparArtistas(texto) {
    return String(texto || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
}

async function listarFaixas(urlOriginal) {
    const url = await resolverLinkCurto(urlOriginal);
    const alvo = lerEntidade(url);
    if (!alvo) throw new Error('link do Spotify não reconhecido');
    const ent = await buscarEntidade(alvo.tipo, alvo.id);

    if (alvo.tipo === 'track') {
        return {
            tipo: 'track',
            nome: ent.title || ent.name || '',
            capa: capaDe(ent),
            faixas: [{
                id: ent.id || alvo.id,
                titulo: ent.title || ent.name || '',
                artistas: limparArtistas((ent.artists || []).map(a => a.name).filter(Boolean).join(', ')),
                duracaoMs: ent.duration || 0,
                explicita: Boolean(ent.isExplicit)
            }]
        };
    }

    const faixas = (ent.trackList || []).map(f => ({
        id: String(f.uri || '').split(':').pop(),
        titulo: f.title || '',
        artistas: limparArtistas(f.subtitle),
        duracaoMs: f.duration || 0,
        explicita: Boolean(f.isExplicit)
    })).filter(f => f.id && f.titulo);

    return { tipo: alvo.tipo, nome: ent.name || ent.title || '', capa: capaDe(ent), faixas };
}

// Entre os cinco primeiros resultados do YouTube, fica o que mais parece a
// gravação original: duração mais próxima da do Spotify, de preferência no canal
// do próprio artista, e que não seja ao vivo, cover, karaokê, remix ou versão
// acelerada — a não ser que a faixa do Spotify também seja.
const VERSOES = /\b(live|ao vivo|en vivo|cover|karaok[eê]|instrumental|slowed|sped ?up|nightcore|8d|reverb|remix|acoustic|ac[uú]stico)\b/i;

function pontuar(candidato, faixa) {
    const alvo = faixa.duracaoMs / 1000;
    const diferenca = alvo && candidato.duracao ? Math.abs(candidato.duracao - alvo) : 30;
    let pontos = diferenca;
    if (diferenca > 30) pontos += 100;
    if (VERSOES.test(candidato.titulo) && !VERSOES.test(faixa.titulo)) pontos += 40;
    const artistaPrincipal = faixa.artistas.split(',')[0].trim().toLowerCase();
    if (artistaPrincipal && candidato.canal.toLowerCase().includes(artistaPrincipal)) pontos -= 5;
    if (/official audio|[aá]udio oficial/i.test(candidato.titulo)) pontos -= 3;
    return pontos;
}

async function buscarNoYouTube(consulta, binPath) {
    const resultado = await youtubedl.exec(`ytsearch5:${consulta}`, {
        dumpJson: true,
        flatPlaylist: true,
        skipDownload: true,
        noWarnings: true,
        noCheckCertificates: true
    }, { executablePath: binPath });

    const candidatos = String(resultado.stdout || '')
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean)
        .map(l => { try { return JSON.parse(l); } catch (e) { return null; } })
        .filter(Boolean)
        .map(d => ({
            url: d.webpage_url || d.url || (d.id ? `https://www.youtube.com/watch?v=${d.id}` : null),
            titulo: d.title || '',
            canal: d.channel || d.uploader || '',
            duracao: d.duration || 0
        }))
        .filter(c => c.url);
    return candidatos;
}

// Vídeos do YouTube para a faixa, do mais provável ao menos provável. Com
// muitos artistas no nome ("A, B, C, D - Título") a busca às vezes volta
// vazia; aí tenta de novo só com o artista principal.
async function candidatosNoYouTube(faixa, binPath) {
    const artistaPrincipal = faixa.artistas.split(',')[0].trim();
    const consultas = [`${faixa.artistas} - ${faixa.titulo}`];
    if (artistaPrincipal && artistaPrincipal !== faixa.artistas.trim()) consultas.push(`${artistaPrincipal} - ${faixa.titulo}`);
    for (const consulta of consultas) {
        const candidatos = await buscarNoYouTube(consulta, binPath);
        if (candidatos.length) return candidatos.sort((a, b) => pontuar(a, faixa) - pontuar(b, faixa));
    }
    return [];
}

// Se o primeiro vídeo não baixar, os seguintes só servem se a duração bater e
// não forem outra versão (ao vivo, remix...): melhor falhar que baixar a
// música errada.
function serveComoAlternativa(candidato, faixa) {
    return pontuar(candidato, faixa) < 40;
}

// "Artista - Título", sem os caracteres que o Windows não aceita em nome de
// arquivo e sem emojis — pen drive em FAT32 e o Rekordbox nem sempre lidam bem
// com eles. Fica bem mais legível que o título do vídeo do YouTube.
function nomeDeArquivo(faixa) {
    const base = `${faixa.artistas} - ${faixa.titulo}`
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/[\p{Extended_Pictographic}\p{So}‍️]/gu, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 150);
    return base || 'Faixa do Spotify';
}

module.exports = { ehSpotify, listarFaixas, candidatosNoYouTube, serveComoAlternativa, nomeDeArquivo, pontuar };
