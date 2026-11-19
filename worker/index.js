const MODEL = "@cf/black-forest-labs/flux-1-schnell";
const ALLOWED_ORIGINS = new Set([
  "https://pedrinhoolindio-alt.github.io",
]);

const MAX_PROMPT_LENGTH = 1400;
const MAX_STEPS = 4;

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...corsHeaders(origin),
    },
  });
}

function makePrompt(scene, sport) {
  const scenes = {
    stadium: "A dramatic world-class football stadium at night, packed crowd, powerful floodlights, subtle atmospheric haze, cinematic sports photography, deep shadows, premium editorial sports campaign, realistic architecture, high contrast, no people in foreground",
    tunnel: "A dramatic professional stadium players tunnel opening toward a brilliantly lit pitch, cinematic sports photography, atmospheric haze, premium editorial campaign, deep shadows, no people, no text",
    arena: "A monumental modern sports arena at night, dramatic floodlights, energetic crowd as soft background texture, cinematic sports photography, premium editorial sports campaign, no people in foreground",
    abstract: "A premium abstract sports campaign background, dynamic diagonal energy forms, stadium light beams, subtle particles, rich cinematic contrast, sophisticated graphic design, no people, no text",
  };

  const chosen = scenes[scene] || scenes.stadium;
  const discipline = sport === "basketball" ? "basketball" :
    sport === "volleyball" ? "volleyball" :
    sport === "american-football" ? "American football" : "football";

  return `${chosen}. Visual theme: ${discipline}. Compose as a clean background plate with generous uncluttered central space for real athlete cutouts, club crests and typography to be composited later. Portrait-friendly composition, no words, no letters, no numbers, no logos, no watermarks, no recognizable athletes.`;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (!ALLOWED_ORIGINS.has(origin)) {
      return new Response("Forbidden origin", { status: 403 });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, origin);
    }

    if (!env.AI) {
      return json({ error: "Workers AI binding 'AI' is not configured." }, 503, origin);
    }

    // Fail closed: do not spend AI quota unless the rate-limit binding is configured.
    if (!env.FLUX_RATE_LIMIT) {
      return json({ error: "Rate limiter is not configured. Add the FLUX_RATE_LIMIT binding before enabling generation." }, 503, origin);
    }

    const clientIp = request.headers.get("CF-Connecting-IP");
    if (!clientIp) {
      return json({ error: "Unable to identify request source." }, 400, origin);
    }

    // Approximate limit: 5 generations per 60 seconds per IP, per Cloudflare location.
    const { success } = await env.FLUX_RATE_LIMIT.limit({ key: "flux:" + clientIp });
    if (!success) {
      return json({ error: "Limite de 5 gerações por minuto atingido. Aguarde um pouco e tente novamente." }, 429, origin);
    }

    const contentLength = Number(request.headers.get("Content-Length") || 0);
    if (contentLength > 8192) {
      return json({ error: "Request too large." }, 413, origin);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body." }, 400, origin);
    }

    const scene = ["stadium", "tunnel", "arena", "abstract"].includes(body.scene)
      ? body.scene : "stadium";
    const sport = ["football", "basketball", "volleyball", "american-football"].includes(body.sport)
      ? body.sport : "football";

    // Prompt is composed server-side: the browser cannot request arbitrary model behavior.
    const prompt = makePrompt(scene, sport);
    if (prompt.length > MAX_PROMPT_LENGTH) {
      return json({ error: "Prompt too long." }, 400, origin);
    }

    try {
      const result = await env.AI.run(MODEL, {
        prompt,
        steps: MAX_STEPS,
      });

      if (!result || typeof result.image !== "string" || !result.image.length) {
        return json({ error: "The image model returned an empty result." }, 502, origin);
      }

      return json({
        image: `data:image/jpeg;base64,${result.image}`,
        model: MODEL,
        scene,
        steps: MAX_STEPS,
      }, 200, origin);
    } catch (error) {
      const message = String(error?.message || error);
      const status = /limit|quota|neuron|exceed/i.test(message) ? 429 : 502;
      return json({
        error: status === 429
          ? "Daily Workers AI free allowance reached. Try again after the daily reset."
          : "Image generation failed. Please try again later.",
      }, status, origin);
    }
  },
};
