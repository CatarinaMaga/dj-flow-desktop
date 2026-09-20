# 🎚️ DJ Flow — qualidade real das suas músicas e Cofre organizado para o Rekordbox

O **DJ Flow** é um app gratuito para Windows feito para DJs que usam **Rekordbox**. Ele fica sempre visível ao lado do Rekordbox, guarda suas faixas numa pasta organizada (o **Cofre DJ Flow**) e mostra se cada música tem qualidade suficiente para tocar num sistema de som de clube.

Feito por **Catarina Magalhães**, DJ e desenvolvedora de sistemas e aplicativos.

**[⬇️ Baixar a versão mais recente](https://github.com/CatarinaMaga/dj-flow-desktop/releases/latest)** · **[DJ Flow Pro: responda a pesquisa](https://djflow-pro.vercel.app)** · **[English](#-english)**

## ✨ Funções

- **Português e inglês:** o app escolhe o idioma do Windows automaticamente, e dá pra trocar no seletor PT/EN no topo.
- **Download em lote:** cole vários links de uma vez, **separados por um espaço**, e o app baixa um atrás do outro mostrando a fila. O link de uma playlist ou álbum inteiro também funciona sozinho.
- **Detector de qualidade:** analisa os agudos de cada faixa do Cofre e mostra se ela é de qualidade Alta, Média, Baixa ou Muito baixa. Também avisa quando um arquivo diz ter 320 kbps ou ser sem perdas, mas foi convertido de uma fonte fraca.
- **Cofre DJ Flow:** pasta dedicada em `Músicas\Cofre DJ Flow`, pronta para importar no Rekordbox.
- **Sempre visível:** a janela não some quando você clica no Rekordbox.
- **Registro de atividade** que continua salvo quando você fecha o app.
- **Atualização automática do motor de download** e aviso quando sai uma versão nova do app.

## ❓ Como saber se minha música é 320 kbps de verdade?

O número de kbps nas propriedades do arquivo é só um rótulo: um arquivo convertido de uma fonte de 128 kbps continua dizendo "320", mas já perdeu os agudos. O teste real é o espectro de frequências:

| Arquivo | Até onde vão os agudos |
|---|---|
| WAV, AIFF, FLAC (sem perdas) | ~22 kHz |
| MP3 320 kbps verdadeiro | ~20 kHz |
| Áudio do YouTube (~128 kbps) | ~16 kHz |

O detector do DJ Flow faz essa conferência automaticamente: abra o app e clique em **🎚️ Qualidade**.

## ❓ Por que meu pen drive não toca no CDJ?

> Usa controladora (DDJ) com notebook? Aí quem lê o arquivo é o Rekordbox, não o aparelho: FLAC e ALAC funcionam normalmente, mas formatos de internet como Opus e WebM não tocam.

As causas mais comuns:

1. **Pen drive formatado em NTFS.** Os CDJs leem FAT32; alguns modelos mais novos também aceitam exFAT (confira o manual do seu).
2. **Formato de arquivo não suportado.** Modelos mais antigos não tocam FLAC nem ALAC.
3. **Músicas copiadas direto para o pen drive.** Exporte pelo Rekordbox para levar playlists, cue points e grades de batida.

## 📥 Como instalar

1. Baixe o instalador em **[Releases](https://github.com/CatarinaMaga/dj-flow-desktop/releases/latest)**.
2. Abra o arquivo. Como o app ainda não tem assinatura digital, o Windows pode mostrar "O Windows protegeu o computador": clique em **Mais informações → Executar assim mesmo**.
3. No primeiro acesso, o app cria a pasta `Cofre DJ Flow` na sua pasta de Músicas.
4. No Rekordbox, adicione essa pasta à sua coleção.

## ⚖️ Uso responsável

Use o DJ Flow apenas com músicas que você tem direito de usar: compradas, licenciadas, em domínio público ou liberadas pelo artista. Para tocar em público, prefira arquivos de lojas oficiais (Beatport, Bandcamp) ou de record pools.

## 🌎 English

**DJ Flow** is a free Windows companion app for DJs who use **Rekordbox**. It stays on top of Rekordbox, keeps your tracks in a dedicated folder (the **Cofre DJ Flow** vault) and tells you whether each track has enough quality for a club sound system. The interface is available in **English and Portuguese**: it follows your Windows language, and you can switch it with the PT/EN selector.

**Features**
- **Batch downloads:** paste several links at once, **separated by a space**, and the app downloads them one after another showing the queue. A whole playlist or album link also works on its own.
- **Quality detector:** analyzes the real high-frequency cutoff of every track in the vault and rates it High, Medium, Low or Very low. It also flags files that claim to be 320 kbps or lossless but were transcoded from a weak source.
- **Vault folder** at `Music\Cofre DJ Flow`, ready to import into Rekordbox.
- **Always on top**, so it doesn't disappear behind Rekordbox.
- **Persistent activity log**, automatic download-engine updates and new-version notices.

**Playing on a controller instead of CDJs?** With a DDJ (or any controller) your laptop plays the file, so Rekordbox decides what works: FLAC and ALAC are fine, but web formats like Opus and WebM still won't play.

**Is my track really 320 kbps?** The bitrate in the file properties is just a label. A file converted from a 128 kbps source still says "320" but has already lost its highs. A true 320 kbps MP3 reaches about 20 kHz, lossless files about 22 kHz, and YouTube audio (~128 kbps) usually cuts off near 16 kHz. Click **🎚️ Quality** in the app to check your whole vault.

**Install:** download the installer from **[Releases](https://github.com/CatarinaMaga/dj-flow-desktop/releases/latest)**. The app isn't code-signed yet, so Windows may show "Windows protected your PC": click **More info → Run anyway**.

Only use DJ Flow with music you have the right to use (purchased, licensed, public domain or released by the artist).

Made by **Catarina Magalhães**, developer and DJ.

## 💻 Para desenvolvedores / For developers

Feito com Electron, Node.js, Express e yt-dlp.

```bash
# Instalar dependências
npm install

# Rodar em modo desenvolvimento
npm start

# Gerar instalador (.exe) na pasta dist/
npm run build
```

---
Palavras-chave: rekordbox, CDJ, pen drive, DJ, qualidade de música, 320 kbps, bitrate, espectro de frequências, organizar biblioteca musical, Pioneer DJ, AlphaTheta.
