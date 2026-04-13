# 🎚️ DJ Flow - Rekordbox Companion

O **DJ Flow** é uma ferramenta de produtividade para DJs que utilizam o Rekordbox. Ele foi desenhado para ser um "widget" que fica sempre visível sobre outros programas, permitindo baixar músicas do YouTube instantaneamente para uma pasta organizada no Windows.

## ✨ Principais Diferenciais

- **Always-on-Top**: A janela do app não some quando você clica no Rekordbox. Ideal para baixar faixas novas enquanto organiza sua biblioteca.
- **Cofre DJ Flow**: Cria automaticamente uma pasta dedicada em `Músicas\Cofre DJ Flow`, facilitando a importação em lote para o Rekordbox.
- **Workflow Acelerado**: Basta colar a URL e clicar em baixar. O arquivo é materializado no disco pronto para uso.
- **Baixo Consumo**: Interface leve e minimalista focada apenas no que importa: ter a música agora.

## 🛠️ Tecnologias

- **Electron**: Para a interface desktop tipo widget.
- **Node.js**: Backend integrado para gerenciar o motor de download.
- **yt-dlp**: Para garantir downloads estáveis e em alta qualidade sonora.
- **Express**: Bridge de comunicação interna.

## 📥 Como Usar

1.  **Instalação**: Baixe o instalador disponível na aba [Releases](https://github.com/CatarinaMaga/dj-flow-desktop/releases) (ou execute via código).
2.  **Primeiro Acesso**: O app criará a pasta `Cofre DJ Flow` na sua biblioteca de Músicas.
3.  **Download**: Cole o link do YouTube, clique em "Baixar" e veja a mágica acontecer.
4.  **No Rekordbox**: Arraste os arquivos da pasta diretamente para sua coleção.

## 💻 Para Desenvolvedores

```bash
# Instalar dependências
npm install

# Rodar em modo desenvolvimento
npm start

# Gerar instalador (.exe)
npm run build
```

---
Elevando o nível da sua pesquisa musical. 🎧
