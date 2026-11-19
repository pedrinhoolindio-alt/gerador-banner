# Gerador Banner — Cloudflare FLUX Worker

Worker de geração de fundos esportivos para o app GitHub Pages.

## Configuração no painel Cloudflare

1. Workers & Pages → Create → Worker.
2. Nome sugerido: `gerador-banner-ai`.
3. Após criar, abra Settings → Bindings → Add → Workers AI.
4. Variable name: `AI`. Salve.
5. Em Edit code, substitua o código pelo conteúdo de `index.js`.
6. Deploy.

## Endpoint

`POST https://gerador-banner-ai.<SEU-SUBDOMINIO>.workers.dev`

JSON:
```json
{ "scene": "stadium", "sport": "football" }
```

Cenas permitidas: `stadium`, `tunnel`, `arena`, `abstract`.

Esportes permitidos: `football`, `basketball`, `volleyball`, `american-football`.

Resposta:
```json
{ "image": "data:image/jpeg;base64,...", "model": "@cf/black-forest-labs/flux-1-schnell", "scene": "stadium", "steps": 4 }
```

## Segurança e limites

- CORS aceita somente `https://pedrinhoolindio-alt.github.io`.
- Método POST, payload pequeno, cena/esporte em lista fechada.
- Prompt montado no servidor; não aceita prompt livre do navegador.
- FLUX Schnell limitado a 4 steps por chamada.
- O limite gratuito de Workers AI é compartilhado pela conta: 10.000 Neurons/dia. Ao exceder, novas inferências falham no plano Free.
- O Worker exige o binding `FLUX_RATE_LIMIT`; sem ele, a geração falha de forma fechada (HTTP 503), evitando inferências sem o limitador ativo.
- O limite configurado é de 5 gerações por 60 segundos por IP e por localização Cloudflare. É aproximado/distribuído, não é um teto diário rígido nem uma proteção contra todo abuso.
- `wrangler.jsonc` declara os bindings `AI` e `FLUX_RATE_LIMIT`. Para aplicar a configuração, publique o Worker com Wrangler usando esse arquivo ou crie o binding Rate Limiting equivalente no painel Cloudflare. Não habilite Workers Paid nem adicione cartão para este projeto.

## Modelo e preço

`@cf/black-forest-labs/flux-1-schnell` — documentação:
https://developers.cloudflare.com/workers-ai/models/flux-1-schnell/

Preço/consumo:
https://developers.cloudflare.com/workers-ai/platform/pricing/


## Publicação com Wrangler

O arquivo `wrangler.jsonc` declara o binding Workers AI (`AI`) e o limitador (`FLUX_RATE_LIMIT`). Ao publicar com Wrangler, confirme que a conta permanece no plano Free e que os bindings aparecem no ambiente de produção. Se continuar usando o editor do painel, adicione o binding Rate Limiting com nome `FLUX_RATE_LIMIT`, namespace `7811192026`, limite `5` e período `60` segundos antes de implantar o novo código.


## Deploy pelo navegador (GitHub Actions)

Foi adicionado o workflow manual `.github/workflows/deploy-flux-worker.yml`. Para utilizá-lo sem instalar Wrangler no computador:

1. No Cloudflare, copie o **Account ID** da conta.
2. Crie um API Token na Cloudflare com permissão de edição de Workers Scripts para essa conta. Não compartilhe o token no chat.
3. No GitHub, abra Settings > Secrets and variables > Actions e crie os secrets `CLOUDFLARE_ACCOUNT_ID` e `CLOUDFLARE_API_TOKEN`.
4. Abra Actions > Deploy FLUX Worker > Run workflow.

O workflow publica o Worker usando `wrangler.jsonc`, que declara o binding Workers AI `AI` e o rate limiter `FLUX_RATE_LIMIT` (5 chamadas por 60 segundos). O rate limiter é aproximado e por localização Cloudflare, não um limite diário rígido. A geração permanece operacional sem o binding, mas sem rate limiting, até o deploy com essa configuração.
