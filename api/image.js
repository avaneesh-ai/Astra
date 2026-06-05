import { cleanText, readJson, requireMethod, sendJson } from "../lib/api-utils.js";

function hashString(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function escapeXml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fallbackImage(prompt, style) {
  const seed = hashString(`${prompt}:${style}`);
  const palette = [
    ["#173f35", "#f0b95b", "#df5b45", "#f8f1e4"],
    ["#1f2937", "#47a992", "#e9b44c", "#fff8ec"],
    ["#3b2f5c", "#68c1a5", "#f26d5b", "#f6efe3"],
    ["#17324d", "#e7a84d", "#60a76f", "#fffaf2"]
  ][seed % 4];
  const words = prompt.split(" ").filter(Boolean).slice(0, 18);
  const lines = [];
  while (words.length) {
    lines.push(words.splice(0, 5).join(" "));
  }

  const shapes = Array.from({ length: 16 }, (_, index) => {
    const x = 60 + ((seed + index * 83) % 900);
    const y = 70 + ((seed + index * 137) % 780);
    const size = 24 + ((seed + index * 19) % 120);
    const color = palette[index % palette.length];
    const opacity = 0.18 + ((index % 5) * 0.08);
    return `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="8" fill="${color}" opacity="${opacity}" transform="rotate(${(seed + index * 17) % 45} ${x} ${y})"/>`;
  }).join("");

  const text = lines
    .map((line, index) => `<text x="90" y="${520 + index * 48}" fill="#fffaf2" font-size="34" font-family="Inter, Arial, sans-serif" font-weight="700">${escapeXml(line)}</text>`)
    .join("");

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">` +
    `<rect width="1024" height="1024" fill="${palette[0]}"/>` +
    `<path d="M0 740 C180 650 260 780 420 690 C610 582 690 676 1024 560 L1024 1024 L0 1024 Z" fill="${palette[1]}" opacity=".82"/>` +
    `<path d="M0 240 C220 150 340 310 520 220 C710 126 810 190 1024 120 L1024 0 L0 0 Z" fill="${palette[2]}" opacity=".72"/>` +
    shapes +
    `<circle cx="${180 + (seed % 200)}" cy="${180 + (seed % 140)}" r="${80 + (seed % 80)}" fill="${palette[3]}" opacity=".18"/>` +
    `<text x="90" y="128" fill="#fffaf2" font-size="30" font-family="Inter, Arial, sans-serif" font-weight="700" opacity=".86">Astra_AI Image</text>` +
    `<text x="90" y="178" fill="#fffaf2" font-size="22" font-family="Inter, Arial, sans-serif" opacity=".74">${escapeXml(style)}</text>` +
    text +
    `</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function extractImage(data) {
  if (!data) return "";
  if (typeof data.image === "string") return data.image;
  if (typeof data.url === "string") return data.url;
  if (typeof data.output === "string") return data.output;
  if (Array.isArray(data.data) && data.data[0]?.url) return data.data[0].url;
  if (Array.isArray(data.data) && data.data[0]?.b64_json) return `data:image/png;base64,${data.data[0].b64_json}`;
  if (Array.isArray(data.images) && data.images[0]) return data.images[0];
  return "";
}

export default async function handler(req, res) {
  if (!requireMethod(req, res, "POST")) return;

  const body = await readJson(req);
  const prompt = cleanText(body.prompt, 1200);
  const style = cleanText(body.style || "Cinematic", 120);
  const model = cleanText(body.model || process.env.IMAGE_MODEL || "", 120);

  if (!prompt) {
    sendJson(res, 400, { ok: false, error: "Enter an image prompt." });
    return;
  }

  const imageEndpoint = process.env.IMAGE_API_URL || process.env.OLLAMA_IMAGE_URL;

  if (imageEndpoint) {
    try {
      const headers = { "Content-Type": "application/json" };
      if (process.env.IMAGE_API_KEY) {
        headers.Authorization = `Bearer ${process.env.IMAGE_API_KEY}`;
      }

      const response = await fetch(imageEndpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({ prompt, style, model })
      });
      const data = await response.json().catch(() => ({}));
      const image = extractImage(data);

      if (response.ok && image) {
        sendJson(res, 200, { ok: true, image, source: "connected" });
        return;
      }
    } catch {
      // Fall back to a generated SVG below.
    }
  }

  sendJson(res, 200, {
    ok: true,
    image: fallbackImage(prompt, style),
    source: "local-svg"
  });
}
