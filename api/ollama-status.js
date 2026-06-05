import { cleanText, requireMethod, sendJson } from "../lib/api-utils.js";

function getOllamaConfig() {
  const configuredHost =
    process.env.OLLAMA_BASE_URL ||
    process.env.OLLAMA_HOST ||
    process.env.OLLAMA_API_BASE_URL ||
    process.env.OLLAMA_URL ||
    process.env.OLLAMA_SERVER_URL ||
    (process.env.OLLAMA_API_KEY ? "https://ollama.com" : "");

  const usingDirectCloud =
    !process.env.OLLAMA_BASE_URL &&
    !process.env.OLLAMA_HOST &&
    !process.env.OLLAMA_API_BASE_URL &&
    !process.env.OLLAMA_URL &&
    !process.env.OLLAMA_SERVER_URL &&
    Boolean(process.env.OLLAMA_API_KEY);

  const baseUrl = configuredHost
    .replace(/\/$/, "")
    .replace(/\/v1$/, "")
    .replace(/\/api$/, "");

  return {
    endpoint: process.env.OLLAMA_CHAT_ENDPOINT || (baseUrl ? `${baseUrl}/api/chat` : ""),
    hasApiKey: Boolean(process.env.OLLAMA_API_KEY),
    model: cleanText(process.env.OLLAMA_MODEL || (usingDirectCloud ? "gpt-oss:120b" : "llama3.1:8b"), 80),
    mode: usingDirectCloud ? "Ollama Cloud" : baseUrl ? "Custom Ollama server" : "Not configured"
  };
}

export default async function handler(req, res) {
  if (!requireMethod(req, res, "GET")) return;

  const config = getOllamaConfig();

  if (!config.endpoint) {
    sendJson(res, 200, {
      ok: false,
      ...config,
      message: "Missing Ollama environment variables. Add OLLAMA_API_KEY and OLLAMA_MODEL in Vercel, then redeploy."
    });
    return;
  }

  if (config.mode === "Ollama Cloud" && !config.hasApiKey) {
    sendJson(res, 200, {
      ok: false,
      ...config,
      message: "Missing OLLAMA_API_KEY."
    });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const headers = { "Content-Type": "application/json" };
    if (process.env.OLLAMA_API_KEY) {
      headers.Authorization = `Bearer ${process.env.OLLAMA_API_KEY}`;
    }

    const response = await fetch(config.endpoint, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: config.model,
        stream: false,
        messages: [{ role: "user", content: "Reply with OK." }]
      })
    });

    const data = await response.json().catch(() => ({}));

    sendJson(res, 200, {
      ok: response.ok,
      ...config,
      message: response.ok
        ? "Ollama connected."
        : data.error || `Ollama returned HTTP ${response.status}. Check your API key and model.`
    });
  } catch (error) {
    sendJson(res, 200, {
      ok: false,
      ...config,
      message:
        error?.name === "AbortError"
          ? "Ollama connection timed out."
          : "Could not reach Ollama. Check the environment variables and redeploy."
    });
  } finally {
    clearTimeout(timeout);
  }
}
