import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import chat from "./api/chat-local.js";
import image from "./api/image.js";
import ollamaStatus from "./api/ollama-status.js";
import sendLoginLink from "./api/send-login-link.js";

const root = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(root, "public");
const port = Number(process.env.PORT || 4173);

const apiHandlers = {
  "/api/chat": chat,
  "/api/image": image,
  "/api/ollama-status": ollamaStatus,
  "/api/send-login-link": sendLoginLink
};

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8"
};

function makeResponse(res) {
  return {
    setHeader: (...args) => res.setHeader(...args),
    end: (body) => res.end(body),
    get statusCode() {
      return res.statusCode;
    },
    set statusCode(value) {
      res.statusCode = value;
    }
  };
}

async function readBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(raw || "{}"));
      } catch {
        resolve({});
      }
    });
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  const pathname = url.pathname.replace(/\/$/, "") || "/";

  if (apiHandlers[pathname]) {
    req.body = await readBody(req);
    await apiHandlers[pathname](req, makeResponse(res));
    return;
  }

  const requested = pathname === "/" ? "/index.html" : pathname;
  const safePath = normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(publicDir, safePath);
  const resolvedPublic = normalize(publicDir);

  if (!normalize(filePath).startsWith(resolvedPublic) || !existsSync(filePath)) {
    const fallback = await readFile(join(publicDir, "index.html"));
    res.writeHead(200, { "Content-Type": contentTypes[".html"] });
    res.end(fallback);
    return;
  }

  res.writeHead(200, { "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream" });
  createReadStream(filePath).pipe(res);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Astra_AI is running at http://localhost:${port}`);
});
