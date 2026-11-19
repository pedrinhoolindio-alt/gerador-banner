# Gerador Banner — Cloudflare FLUX Worker

Worker de geração de fundos esportivos para o app GitHub Pages.

## Configuração no painel Cloudflare

1. Workers & Pages → Create → Worker.
2. Nome: `gerador-banner-ai`.
3. Em Settings → Bindings, adicione Workers AI com o nome `AI`.
4. Publique o Worker.

## Endpoint

`POST https://gerador-banner-ai.<SEU-SUBDOMINIO>.workers.dev`

JSON:
```json
{ "scene": "stadium", "sport": "football" }
```

Cenas permitidas: `stadium`, `tunnel`, `arena`, `abstract`.

Esportes permitidos: `football`, `basketball`, `volleyball`, `american-football`.

## Segurança e limites

- CORS aceita somente `https://pedrinhoolindio-alt.github.io`.
- Método POST, payload pequeno, cena/esporte em lista fechada.
- Prompt montado no servidor; não aceita prompt livre do navegador.
- FLUX Schnell limitado a 4 steps por chamada.
- A franquia gratuita de Workers AI é compartilhada pela conta; ao exceder a cota, novas inferências podem falhar até a renovação.
- O binding opcional `FLUX_RATE_LIMIT` limita aproximadamente 5 gerações por 60 segundos por chave e por localização Cloudflare. O contador é distribuído de forma eventual e não constitui um limite global rígido.
- Sem o binding de rate limit, o Worker continua funcionando, mas sem esse controle adicional.
- O namespace ID deve ser um inteiro positivo e único para este limitador dentro da conta Cloudflare. Se outro Worker usar o mesmo ID, os contadores da mesma chave poderão ser compartilhados.
- Não habilite Workers Paid nem adicione cartão para este projeto.

## Publicação pelo GitHub Actions

O workflow manual está em `.github/workflows/deploy-flux-worker.yml`.

1. Em GitHub → Settings → Secrets and variables → Actions, cadastre os secrets `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`.
2. Abra Actions → Deploy FLUX Worker.
3. Escolha a branch `feat/cloudflare-flux-backgrounds` no seletor de branch ao executar o workflow.
4. Execute somente depois de confirmar os secrets e revisar o arquivo `wrangler.jsonc`.

O token deve ter permissão de edição de Workers Scripts na conta correta. Nunca coloque o token no código do Worker nem o compartilhe no chat.

## Documentação oficial

- Modelo FLUX Schnell: https://developers.cloudflare.com/workers-ai/models/flux-1-schnell/
- Rate Limiting binding: https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
- Preços e franquia: https://developers.cloudflare.com/workers-ai/platform/pricing/
