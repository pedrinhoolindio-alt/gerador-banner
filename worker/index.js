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

function makePrompt(scene, sport, seed) {
  const variants = {
    stadium: [
      "A monumental European football stadium at night, dramatic low camera angle from pitch level, packed crowd fading into atmospheric haze, powerful cold-white floodlights, premium global sports advertising photography",
      "An immense modern football stadium during blue hour, sweeping roof architecture, brilliant floodlight beams through fine mist, energetic crowd as distant texture, cinematic luxury sports campaign",
      "A dramatic championship stadium at night seen from behind one goal, illuminated pitch edges, layered stands, volumetric beams and subtle smoke, photorealistic premium sports editorial",
      "A world-class football venue under intense match lights, architectural roof lines converging toward the center, deep navy shadows, restrained sparks and atmospheric depth, cinematic campaign backdrop"
    ],
    tunnel: [
      "A high-end professional football players tunnel looking out to a luminous stadium pitch, symmetrical architectural perspective, concrete and steel textures, atmospheric haze, dramatic backlight",
      "A dramatic stadium entrance corridor before a major final, strong perspective lines, glowing green pitch at the far end, dark premium materials, volumetric white light",
      "A cinematic football tunnel with open doors revealing a packed illuminated arena, low-angle architectural photography, smoke haze and rich shadow detail",
      "An elite stadium passage at night, illuminated exit framing the playing field, moody charcoal surfaces, controlled light beams, premium sports advertising"
    ],
    arena: [
      "A breathtaking contemporary football arena at night, sweeping stands, brilliant roof lights, distant crowd, dramatic cinematic scale and realistic architectural detail",
      "A packed championship venue seen from a dramatic elevated corner angle, luminous pitch, atmospheric stadium lighting, deep contrast and premium editorial finish",
      "A futuristic but realistic sports stadium bowl, powerful beams crossing above the pitch, distant crowd texture, cinematic night photography",
      "A monumental arena with illuminated roof trusses and layered seating, dramatic haze, deep blacks and crisp highlights, world-class sports campaign background"
    ],
    abstract: [
      "A premium abstract football campaign backdrop, sculptural diagonal energy ribbons, stadium light beams, fine particles, deep navy and charcoal atmosphere, sophisticated graphic design",
      "Dynamic layered geometric forms inspired by football motion, subtle turf texture, controlled electric light streaks, cinematic contrast, elegant negative space",
      "A dramatic abstract sports visual with sweeping diagonal structures, luminous dust, restrained energy trails and rich dark gradients, premium advertising art direction",
      "A bold editorial sports background with angular architectural shapes, atmospheric particles, stadium illumination and a clean central field for graphic composition"
    ]
  };
  const options=variants[scene]||variants.stadium;
  const safeSeed=Number.isInteger(seed)&&seed>=0?seed:Math.floor(Math.random()*2147483647);
  const chosen=options[safeSeed%options.length];
  const discipline = sport === "basketball" ? "basketball" :
    sport === "volleyball" ? "volleyball" :
    sport === "american-football" ? "American football" : "football";
  return `${chosen}. Visual theme: ${discipline}. Compose as a clean professional background plate with generous uncluttered central space for authentic athlete cutouts, club crests and typography to be composited later. Portrait-friendly composition, realistic photographic detail, no words, no letters, no numbers, no logos, no watermarks, no recognizable athletes.`;
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

    // Rate limiting is optional until this Worker is redeployed with Wrangler config.
    // Once FLUX_RATE_LIMIT is available, apply a best-effort per-IP limit.
    if (env.FLUX_RATE_LIMIT) {
      const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";
      const { success } = await env.FLUX_RATE_LIMIT.limit({ key: "flux:" + clientIp });
      if (!success) {
        return json({ error: "Limite temporário de gerações atingido. Aguarde um pouco e tente novamente." }, 429, origin);
      }
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
    const seed = Number.isInteger(body.seed) && body.seed >= 0 && body.seed <= 2147483647 ? body.seed : Math.floor(Math.random() * 2147483647);
    const prompt = makePrompt(scene, sport, seed);
    if (prompt.length > MAX_PROMPT_LENGTH) {
      return json({ error: "Prompt too long." }, 400, origin);
    }

    try {
      const result = await env.AI.run(MODEL, {
        prompt,
        steps: MAX_STEPS,
        seed,
      });

      if (!result || typeof result.image !== "string" || !result.image.length) {
        return json({ error: "The image model returned an empty result." }, 502, origin);
      }

      return json({
        image: `data:image/jpeg;base64,${result.image}`,
        model: MODEL,
        scene,
        seed,
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
