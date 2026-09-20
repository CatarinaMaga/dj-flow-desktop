(function (root) {
    const FFT_SIZE = 8192;
    const MAX_FRAMES = 120;
    const BAND_HZ = 100;
    // Encoders com perdas cortam os agudos num "degrau": em até ~1 kHz o sinal
    // cai dezenas de dB e tudo acima fica sem energia. Música real cai de forma
    // gradual, sem esse vazio acima.
    const CLIFF_DB = 25;
    const TRANSITION_BANDS = 1000 / BAND_HZ;
    const LOSSLESS_EXTENSIONS = ['wav', 'flac', 'aif', 'aiff'];

    function fftInPlace(re, im) {
        const n = re.length;
        for (let i = 1, j = 0; i < n; i++) {
            let bit = n >> 1;
            for (; j & bit; bit >>= 1) j ^= bit;
            j ^= bit;
            if (i < j) {
                [re[i], re[j]] = [re[j], re[i]];
                [im[i], im[j]] = [im[j], im[i]];
            }
        }
        for (let len = 2; len <= n; len <<= 1) {
            const ang = (-2 * Math.PI) / len;
            const wRe = Math.cos(ang);
            const wIm = Math.sin(ang);
            for (let i = 0; i < n; i += len) {
                let curRe = 1;
                let curIm = 0;
                for (let k = 0; k < len / 2; k++) {
                    const aRe = re[i + k];
                    const aIm = im[i + k];
                    const bRe = re[i + k + len / 2] * curRe - im[i + k + len / 2] * curIm;
                    const bIm = re[i + k + len / 2] * curIm + im[i + k + len / 2] * curRe;
                    re[i + k] = aRe + bRe;
                    im[i + k] = aIm + bIm;
                    re[i + k + len / 2] = aRe - bRe;
                    im[i + k + len / 2] = aIm - bIm;
                    const nextRe = curRe * wRe - curIm * wIm;
                    curIm = curRe * wIm + curIm * wRe;
                    curRe = nextRe;
                }
            }
        }
    }

    function averageSpectrumDb(samples, sampleRate) {
        const start = Math.floor(samples.length * 0.1);
        const end = Math.floor(samples.length * 0.9) - FFT_SIZE;
        if (end <= start) return null;

        const frames = Math.min(MAX_FRAMES, Math.floor((end - start) / FFT_SIZE) + 1);
        const step = frames > 1 ? (end - start) / (frames - 1) : 0;
        const window = new Float64Array(FFT_SIZE);
        for (let i = 0; i < FFT_SIZE; i++) window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)));

        const power = new Float64Array(FFT_SIZE / 2);
        const re = new Float64Array(FFT_SIZE);
        const im = new Float64Array(FFT_SIZE);
        for (let f = 0; f < frames; f++) {
            const offset = Math.floor(start + f * step);
            for (let i = 0; i < FFT_SIZE; i++) {
                re[i] = samples[offset + i] * window[i];
                im[i] = 0;
            }
            fftInPlace(re, im);
            for (let i = 0; i < FFT_SIZE / 2; i++) power[i] += re[i] * re[i] + im[i] * im[i];
        }

        const binHz = sampleRate / FFT_SIZE;
        const bandCount = Math.floor(sampleRate / 2 / BAND_HZ);
        const bands = new Float64Array(bandCount);
        for (let b = 0; b < bandCount; b++) {
            const from = Math.floor((b * BAND_HZ) / binHz);
            const to = Math.max(from + 1, Math.floor(((b + 1) * BAND_HZ) / binHz));
            let sum = 0;
            for (let i = from; i < to && i < power.length; i++) sum += power[i];
            bands[b] = 10 * Math.log10(sum / (to - from) / frames + 1e-20);
        }
        return bands;
    }

    function estimateCutoffHz(samples, sampleRate) {
        const bands = averageSpectrumDb(samples, sampleRate);
        if (!bands) return null;

        const nyquist = sampleRate / 2;
        const top = Math.min(bands.length, Math.floor(22000 / BAND_HZ));
        const refBands = Array.from(bands.slice(1000 / BAND_HZ, 6000 / BAND_HZ)).sort((a, b) => a - b);
        const reference = refBands[Math.floor(refBands.length / 2)];

        for (let i = Math.min(top - 1, Math.floor(21500 / BAND_HZ)); i >= 4000 / BAND_HZ; i--) {
            let below = 0;
            for (let k = i - 4; k < i; k++) below += bands[k];
            below /= 4;
            let above = -Infinity;
            for (let k = i + TRANSITION_BANDS; k < bands.length; k++) above = Math.max(above, bands[k]);
            if (above === -Infinity) continue;
            if (below > reference - 50 && below - above > CLIFF_DB) return i * BAND_HZ;
        }
        return Math.min(nyquist, 22050);
    }

    function classify({ cutoffHz, avgKbps, ext }) {
        const lossless = LOSSLESS_EXTENSIONS.includes(ext) || avgKbps >= 700;
        const order = ['muito-baixa', 'baixa', 'media', 'alta'];
        let level;
        if (cutoffHz >= 19500) level = 'alta';
        else if (cutoffHz >= 17500) level = 'media';
        else if (cutoffHz >= 15500) level = 'baixa';
        else level = 'muito-baixa';

        // Mesmo com agudos aparentemente completos, um arquivo com poucos kbps
        // não tem informação suficiente pra soar bem num sistema de som grande.
        if (!lossless) {
            const cap = avgKbps < 160 ? 'baixa' : avgKbps < 250 ? 'media' : 'alta';
            if (order.indexOf(cap) < order.indexOf(level)) level = cap;
        }

        const claimsHighQuality = lossless || avgKbps >= 250;
        const suspicious = claimsHighQuality && cutoffHz < 17500;

        return { level, suspicious, lossless, cutoffHz, avgKbps };
    }

    // O tamanho do arquivo não é só áudio: capa embutida e etiquetas entram na
    // conta e inflam a taxa de bits estimada — uma capa de 2 MB faz um MP3 de
    // 320 kbps parecer ter 450. Aqui descontamos o que não é som. Formato
    // desconhecido ou estrutura inesperada devolve o arquivo inteiro.
    function audioByteLength(buffer, ext) {
        const total = buffer.byteLength;
        const view = new DataView(buffer);
        const texto = (pos, tamanho) => {
            let s = '';
            for (let i = 0; i < tamanho; i++) s += String.fromCharCode(view.getUint8(pos + i));
            return s;
        };

        function mp3Bytes() {
            let inicio = 0;
            let fim = total;
            if (texto(0, 3) === 'ID3') {
                // o tamanho do ID3v2 vem em 4 bytes "syncsafe" (7 bits cada)
                const tamanho = ((view.getUint8(6) & 0x7f) << 21) | ((view.getUint8(7) & 0x7f) << 14) |
                                ((view.getUint8(8) & 0x7f) << 7) | (view.getUint8(9) & 0x7f);
                const rodape = (view.getUint8(5) & 0x10) ? 10 : 0;
                inicio = 10 + tamanho + rodape;
            }
            if (fim >= 128 && texto(fim - 128, 3) === 'TAG') fim -= 128;
            if (fim >= 32 && texto(fim - 32, 8) === 'APETAGEX') fim -= view.getUint32(fim - 20, true);
            return fim - inicio;
        }

        function flacBytes() {
            if (texto(0, 4) !== 'fLaC') return total;
            let pos = 4;
            while (pos + 4 <= total) {
                const flags = view.getUint8(pos);
                const tamanho = (view.getUint8(pos + 1) << 16) | (view.getUint8(pos + 2) << 8) | view.getUint8(pos + 3);
                pos += 4 + tamanho;
                if (flags & 0x80) break; // último bloco de metadados
            }
            return total - pos;
        }

        // Em MP4/M4A o som fica na caixa 'mdat'; capa e índices ficam fora dela.
        function mp4Bytes() {
            let pos = 0;
            let mdat = 0;
            while (pos + 8 <= total) {
                let tamanho = view.getUint32(pos);
                const tipo = texto(pos + 4, 4);
                let cabecalho = 8;
                if (tamanho === 1) {
                    tamanho = view.getUint32(pos + 8) * 4294967296 + view.getUint32(pos + 12);
                    cabecalho = 16;
                } else if (tamanho === 0) {
                    tamanho = total - pos;
                }
                if (tamanho < cabecalho) break;
                if (tipo === 'mdat') mdat += tamanho - cabecalho;
                pos += tamanho;
            }
            return mdat;
        }

        function wavBytes() {
            if (texto(0, 4) !== 'RIFF' || texto(8, 4) !== 'WAVE') return total;
            let pos = 12;
            while (pos + 8 <= total) {
                const tipo = texto(pos, 4);
                const tamanho = view.getUint32(pos + 4, true);
                if (tipo === 'data') return Math.min(tamanho, total - pos - 8);
                pos += 8 + tamanho + (tamanho % 2);
            }
            return total;
        }

        let bytes = 0;
        try {
            if (ext === 'mp3') bytes = mp3Bytes();
            else if (ext === 'flac') bytes = flacBytes();
            else if (ext === 'm4a' || ext === 'mp4') bytes = mp4Bytes();
            else if (ext === 'wav') bytes = wavBytes();
        } catch (e) {
            bytes = 0;
        }
        // Resultado fora do razoável (arquivo estranho) volta pro tamanho cheio.
        return bytes > 0 && bytes <= total ? bytes : total;
    }

    async function analyzeArrayBuffer(arrayBuffer) {
        const ctx = new OfflineAudioContext(1, 1, 48000);
        const audio = await ctx.decodeAudioData(arrayBuffer);
        const mono = new Float32Array(audio.length);
        for (let c = 0; c < audio.numberOfChannels; c++) {
            const data = audio.getChannelData(c);
            for (let i = 0; i < data.length; i++) mono[i] += data[i] / audio.numberOfChannels;
        }
        return { cutoffHz: estimateCutoffHz(mono, audio.sampleRate), duration: audio.duration };
    }

    const api = { estimateCutoffHz, classify, analyzeArrayBuffer, audioByteLength };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.QualityAnalyzer = api;
})(typeof window !== 'undefined' ? window : globalThis);
