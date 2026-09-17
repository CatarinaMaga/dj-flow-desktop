# 🎚️ DJ Flow — qualidade real das suas músicas e Cofre organizado para o Rekordbox

O **DJ Flow** é um app gratuito para Windows feito para DJs que usam **Rekordbox**. Ele fica sempre visível ao lado do Rekordbox, guarda suas faixas numa pasta organizada (o **Cofre DJ Flow**) e mostra se cada música tem qualidade suficiente para tocar num sistema de som de clube.

Feito por **Catarina Magalhães**, DJ e desenvolvedora de sistemas e aplicativos.

**[⬇️ Baixar a versão mais recente](https://github.com/CatarinaMaga/dj-flow-desktop/releases/latest)** · **[DJ Flow Pro: responda a pesquisa](https://djflow-pro.vercel.app)**

## ✨ Funções

- **Detector de qualidade (novo):** analisa os agudos de cada faixa do Cofre e mostra se ela é de qualidade Alta, Média, Baixa ou Muito baixa. Também avisa quando um arquivo diz ter 320 kbps ou ser sem perdas, mas foi convertido de uma fonte fraca.
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

## 💻 Para desenvolvedores

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
