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
- CORS não é autenticação e não impede chamadas fora do navegador. Antes de disponibilizar publicamente, configure uma regra de rate limiting no Cloudflare para este hostname/endpoint. Não habilite Workers Paid nem adicione cartão para este projeto.
- Não há contador próprio persistente neste primeiro corte; não trate CORS como proteção contra abuso.

## Modelo e preço

`@cf/black-forest-labs/flux-1-schnell` — documentação:
https://developers.cloudflare.com/workers-ai/models/flux-1-schnell/

Preço/consumo:
https://developers.cloudflare.com/workers-ai/platform/pricing/
