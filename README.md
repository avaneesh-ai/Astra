# Astra_AI

Astra_AI is a Vercel-ready AI workspace with email-link registration, saved local sessions, an Ollama-powered chatbot named Aurexis, projects, image generation, co-work space, settings, subscription QR, and a laptop-only admin area.

The chatbot endpoint uses a Python LangChain chain with `langchain_ollama.OllamaLLM`, based on the same prompt-history pattern used in the local chatbot example.

## Run locally

```bash
npm run dev
```

Open `http://localhost:4173`.

## Vercel environment variables

Add these in Vercel when you deploy:

```bash
OLLAMA_BASE_URL=https://your-ollama-host.example.com
OLLAMA_API_KEY=optional_if_your_host_requires_it
OLLAMA_MODEL=gpt-oss:120b
RESEND_API_KEY=optional_for_real_email_links
LOGIN_FROM_EMAIL=Astra_AI <login@your-domain.com>
PUBLIC_APP_URL=https://your-vercel-app.vercel.app
IMAGE_API_URL=optional_text_to_image_endpoint
IMAGE_API_KEY=optional_if_your_image_endpoint_requires_it
```

The app works without paid services in local demo mode. Real email delivery needs a mail provider such as Resend, and real image generation can be connected with `IMAGE_API_URL`. Without an image endpoint, Astra_AI creates a safe generated SVG artwork from the prompt.

## Connect Ollama on Vercel

1. Push this project to GitHub.
2. Import the repository into Vercel.
3. Open the Vercel project, then go to Settings -> Environment Variables.
4. Add `OLLAMA_API_KEY` with your Ollama API key.
5. Add `OLLAMA_MODEL`. For Ollama Cloud, use `gpt-oss:120b`.
6. Add `OLLAMA_BASE_URL` only if you use your own Ollama server. You can use either `https://your-ollama-host.example.com` or `https://your-ollama-host.example.com/api`.
7. For local Ollama, set `OLLAMA_BASE_URL` to your server URL and use a model you pulled locally, such as `llama3.1:8b`.
8. Redeploy the Vercel project.
9. Open Astra_AI, go to AI chatbot, choose an Ollama model, and chat with Aurexis.

## Use Projects

1. Open the Project section from the left side.
2. Create a project with a name and goal.
3. Go to AI chatbot and choose that project in the project selector.
4. Aurexis sends the active project name to Ollama so replies stay focused on that project.

Do not paste secret keys into chat. Keep secrets in Vercel environment variables.
