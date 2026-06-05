import json
import os
from http.server import BaseHTTPRequestHandler


TEMPLATE = """
Answer the question below.

Here is the conversation history: {context}

question: {question}

Answer:

"""

CLOUD_DEFAULT_MODEL = "gpt-oss:120b"
CLOUD_SAFE_MODELS = {"gpt-oss:120b", "gpt-oss:20b"}
LOCAL_DEFAULT_MODEL = "llama3"


def clean_text(value, limit=6000):
    return " ".join(str(value or "").split())[:limit]


def configured_host():
    explicit_host = (
        os.environ.get("OLLAMA_BASE_URL")
        or os.environ.get("OLLAMA_HOST")
        or os.environ.get("OLLAMA_API_BASE_URL")
        or os.environ.get("OLLAMA_URL")
        or os.environ.get("OLLAMA_SERVER_URL")
        or ""
    )
    has_api_key = bool(os.environ.get("OLLAMA_API_KEY"))
    host = explicit_host or ("https://ollama.com" if has_api_key else "")
    return host.rstrip("/").removesuffix("/v1").removesuffix("/api")


def is_direct_cloud():
    return (
        not os.environ.get("OLLAMA_BASE_URL")
        and not os.environ.get("OLLAMA_HOST")
        and not os.environ.get("OLLAMA_API_BASE_URL")
        and not os.environ.get("OLLAMA_URL")
        and not os.environ.get("OLLAMA_SERVER_URL")
        and bool(os.environ.get("OLLAMA_API_KEY"))
    )


def choose_model(requested_model):
    env_model = clean_text(os.environ.get("OLLAMA_MODEL"), 80)
    requested_model = clean_text(requested_model, 80)

    if is_direct_cloud():
        return env_model or (requested_model if requested_model in CLOUD_SAFE_MODELS else CLOUD_DEFAULT_MODEL)

    return requested_model or env_model or LOCAL_DEFAULT_MODEL


def build_context(messages):
    lines = []
    for message in messages[:-1][-18:]:
        role = "AI" if message.get("role") == "assistant" else "User"
        content = clean_text(message.get("content"))
        if content:
            lines.append(f"{role}: {content}")
    return "\n".join(lines)


def make_chain(model_name, host, api_key):
    from langchain_core.prompts import ChatPromptTemplate
    from langchain_ollama import OllamaLLM

    model_kwargs = {
        "model": model_name,
        "temperature": float(os.environ.get("OLLAMA_TEMPERATURE", "0.72")),
    }

    if host:
        model_kwargs["base_url"] = host

    if api_key:
        model_kwargs["client_kwargs"] = {"headers": {"Authorization": f"Bearer {api_key}"}}

    model = OllamaLLM(**model_kwargs)
    prompt = ChatPromptTemplate.from_template(TEMPLATE)
    return prompt | model


class handler(BaseHTTPRequestHandler):
    def send_json(self, status, payload):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(json.dumps(payload).encode("utf-8"))

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
            body = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
        except Exception:
            body = {}

        messages = body.get("messages") if isinstance(body.get("messages"), list) else []
        question = clean_text(body.get("question") or (messages[-1].get("content") if messages else ""))
        context = clean_text(body.get("context"), 12000) or build_context(messages)
        model_name = choose_model(body.get("model"))
        host = configured_host()
        api_key = os.environ.get("OLLAMA_API_KEY", "")

        if not question:
            self.send_json(400, {"ok": False, "model": model_name, "reply": "Please enter a message."})
            return

        if is_direct_cloud() and not api_key:
            self.send_json(200, {"ok": False, "model": model_name, "reply": "Missing OLLAMA_API_KEY in Vercel."})
            return

        if not host and not api_key:
            self.send_json(
                200,
                {
                    "ok": False,
                    "model": model_name,
                    "reply": "Aurexis is ready, but Ollama is not connected yet. Add OLLAMA_API_KEY and OLLAMA_MODEL in Vercel, then redeploy.",
                },
            )
            return

        try:
            chain = make_chain(model_name, host, api_key)
            result = chain.invoke({"context": context, "question": question})
            self.send_json(200, {"ok": True, "model": model_name, "reply": str(result)})
        except ImportError:
            self.send_json(
                200,
                {
                    "ok": False,
                    "model": model_name,
                    "reply": "LangChain is not installed yet. Make sure requirements.txt is deployed with langchain-ollama and langchain-core.",
                },
            )
        except Exception as error:
            self.send_json(
                200,
                {
                    "ok": False,
                    "model": model_name,
                    "reply": f"I could not reach Ollama through LangChain yet. Check OLLAMA_API_KEY, OLLAMA_MODEL, and redeploy. Details: {str(error)[:180]}",
                },
            )
