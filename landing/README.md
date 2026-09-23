# Landing do DJ Flow Pro

Página de pesquisa publicada em **https://djflow-pro.vercel.app** (projeto `djflow-pro` na Vercel).
Ela não vende nada: apresenta as ideias da versão paga e leva para o formulário do Google.

## O que tem aqui

| Arquivo | Para que serve |
|---|---|
| `index.html` | a página inteira — texto, estilo e o formulário que abre o Google Forms preenchido |
| `og-image.png`, `icon-192.png` | imagem de pré-visualização ao compartilhar o link e ícone |
| `robots.txt`, `sitemap.xml` | o que os buscadores podem ler |
| `2812ea…txt` | chave do IndexNow, usada para avisar o Bing quando a página muda |
| `api/visita.js` | registra uma visita (a página chama sozinha ao carregar) |
| `api/baixar.js` | conta o download e redireciona para os releases no GitHub |
| `api/metricas.js` | devolve o resumo para o painel do app, protegido por token |
| `lib/contador.js` | a contagem em si: etiqueta diária anônima, filtro de robôs e leitura do resumo |

## Como contamos gente sem identificar ninguém

Para separar "pessoas diferentes" de "acessos", cada visita gera uma etiqueta
`sha256(IP + navegador + dia + segredo)`, cortada em 16 caracteres. Ela muda todo dia,
não volta ao IP e expira em 90 dias. Nenhum IP é gravado, não há cookie e não há
rastreador de terceiros. Robôs são descartados pelo user-agent.

## Variáveis de ambiente (Vercel → Settings → Environment Variables)

| Nome | De onde vem |
|---|---|
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | criadas pela integração Upstash for Redis (banco `djflow-contador`) |
| `METRICAS_TOKEN` | inventada por nós; é o token colado no painel do app (Ctrl+Shift+D) |
| `HASH_SALT` | inventada por nós; o segredo que entra na etiqueta diária |

Sem o banco, a página e o download continuam funcionando — só a contagem é ignorada.

## Publicar uma mudança

```bash
cd landing
npx vercel --prod --scope catarinas-projects-f47cb0a6
```

A pasta `.vercel/`, criada pela CLI, guarda o vínculo com o projeto e **não vai para o Git**.

## Conferir os números pelo terminal

```bash
curl "https://djflow-pro.vercel.app/api/metricas?token=SEU_TOKEN&dias=30"
```
