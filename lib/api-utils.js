export async function readJson(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body || "{}");
    } catch {
      return {};
    }
  }

  return new Promise((resolve) => {
    let raw = "";
    req.on?.("data", (chunk) => {
      raw += chunk;
    });
    req.on?.("end", () => {
      try {
        resolve(JSON.parse(raw || "{}"));
      } catch {
        resolve({});
      }
    });
    if (!req.on) {
      resolve({});
    }
  });
}

export function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader?.("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

export function requireMethod(req, res, method) {
  if ((req.method || "GET").toUpperCase() !== method) {
    sendJson(res, 405, { ok: false, error: `Use ${method}.` });
    return false;
  }
  return true;
}

export function cleanText(value, limit = 4000) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

export function getOrigin(req) {
  const configured = process.env.PUBLIC_APP_URL || process.env.VERCEL_URL;
  if (configured) {
    return configured.startsWith("http") ? configured : `https://${configured}`;
  }

  const proto = req.headers?.["x-forwarded-proto"] || "http";
  const host = req.headers?.host || "localhost:4173";
  return `${proto}://${host}`;
}
