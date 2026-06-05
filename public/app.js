const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const KEYS = {
  user: "astra_ai_user",
  session: "astra_ai_session",
  chats: "astra_ai_chats",
  projects: "astra_ai_projects",
  images: "astra_ai_images",
  cowork: "astra_ai_cowork",
  settings: "astra_ai_settings",
  activeChat: "astra_ai_active_chat",
  adminDevice: "astra_ai_admin_device",
  device: "astra_ai_device"
};

const pendingPrefix = "astra_ai_pending_";
let autoLockTimer;

const modelOptions = [
  { id: "gpt-oss:120b", name: "GPT-OSS 120B Cloud", note: "Ollama Cloud, strongest" },
  { id: "gpt-oss:20b", name: "GPT-OSS 20B Cloud", note: "Ollama Cloud, faster" },
  { id: "llama3.1:8b", name: "Llama 3.1 8B", note: "Balanced daily work" },
  { id: "deepseek-r1:8b", name: "DeepSeek R1 8B", note: "Reasoning and planning" },
  { id: "qwen3:8b", name: "Qwen3 8B", note: "Thinking and multilingual" },
  { id: "qwen2.5:14b", name: "Qwen2.5 14B", note: "Long context writing" },
  { id: "gemma3:12b", name: "Gemma 3 12B", note: "Capable single-GPU model" },
  { id: "mistral:7b", name: "Mistral 7B", note: "Fast practical replies" },
  { id: "llama3.2:3b", name: "Llama 3.2 3B", note: "Lightweight and quick" },
  { id: "qwen2.5-coder:7b", name: "Qwen Coder 7B", note: "Code help" },
  { id: "codellama:13b", name: "Code Llama 13B", note: "Programming projects" },
  { id: "llava:7b", name: "LLaVA 7B", note: "Vision-ready workflows" }
];

const sectionMeta = {
  chat: ["AI chatbot", "Aurexis"],
  projects: ["Project", "Projects"],
  images: ["Image", "Image"],
  cowork: ["Co-work", "Co-work"],
  settings: ["Settings", "Astra_AI"],
  admin: ["Admin", "Laptop admin"]
};

const defaultSettings = {
  defaultModel: "llama3.1:8b",
  friendlyMode: true,
  voiceMode: false,
  safetyMode: true,
  saveMemory: true,
  theme: "dark",
  autoLockMinutes: "0",
  paymentLink: "https://astra-ai.app/pay/pro-yearly?amount=25",
  paymentStatus: "not-paid"
};

let state = {
  user: read(KEYS.user, null),
  session: read(KEYS.session, null),
  chats: read(KEYS.chats, []),
  projects: read(KEYS.projects, []),
  images: read(KEYS.images, []),
  cowork: read(KEYS.cowork, []),
  settings: { ...defaultSettings, ...read(KEYS.settings, {}) },
  activeChatId: localStorage.getItem(KEYS.activeChat) || "",
  activeSection: "chat",
  draftUser: null
};

function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function id(prefix) {
  const value = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${value}`;
}

function getDeviceId() {
  let device = localStorage.getItem(KEYS.device);
  if (!device) {
    device = id("device");
    localStorage.setItem(KEYS.device, device);
  }
  return device;
}

function isLocalPreview() {
  return ["localhost", "127.0.0.1", ""].includes(window.location.hostname);
}

function isAdminLaptop() {
  return localStorage.getItem(KEYS.adminDevice) === getDeviceId();
}

function markAdminLaptop(firstDevice = false) {
  if (!localStorage.getItem(KEYS.adminDevice) && (firstDevice || isLocalPreview())) {
    localStorage.setItem(KEYS.adminDevice, getDeviceId());
  }
}

function saveState() {
  write(KEYS.user, state.user);
  write(KEYS.session, state.session);
  if (state.settings.saveMemory) {
    write(KEYS.chats, state.chats);
  }
  write(KEYS.projects, state.projects);
  write(KEYS.images, state.images);
  write(KEYS.cowork, state.cowork);
  write(KEYS.settings, state.settings);
  if (state.activeChatId) {
    localStorage.setItem(KEYS.activeChat, state.activeChatId);
  }
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.add("hidden"), 3200);
}

function formatTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function createDetail(label, value) {
  const row = document.createElement("div");
  row.className = "detail-row";
  const labelEl = document.createElement("span");
  labelEl.textContent = label;
  const valueEl = document.createElement("strong");
  valueEl.textContent = value || "Not set";
  row.append(labelEl, valueEl);
  return row;
}

function boot() {
  getDeviceId();
  applyTheme();
  fillModelSelects();
  bindAuth();
  bindApp();

  const verifyToken = new URLSearchParams(window.location.search).get("verify");
  if (verifyToken) {
    showVerifyModal(verifyToken);
    return;
  }

  if (state.session?.loggedIn && state.user?.email) {
    enterApp();
  }
}

function applyTheme() {
  const theme = state.settings.theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = theme;
  const toggle = $("#themeToggle");
  if (toggle) {
    toggle.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
    toggle.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
  }
}

function toggleTheme() {
  state.settings.theme = state.settings.theme === "dark" ? "light" : "dark";
  saveState();
  applyTheme();
  renderSettings();
}

function resetAutoLock() {
  window.clearTimeout(autoLockTimer);
  const minutes = Number(state.settings.autoLockMinutes || 0);
  if (!minutes || !state.session?.loggedIn) return;

  autoLockTimer = window.setTimeout(() => {
    state.session = null;
    localStorage.removeItem(KEYS.session);
    showToast("Astra_AI locked for safety.");
    window.setTimeout(() => location.reload(), 700);
  }, minutes * 60 * 1000);
}

function bindAuth() {
  $("#stepOneForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const email = $("#emailInput").value.trim().toLowerCase();
    const password = $("#passwordInput").value;

    if (!email.includes("@") || password.length < 6) {
      showToast("Use a valid email and a password with at least 6 characters.");
      return;
    }

    state.draftUser = { email, passwordSet: true };
    $("#stepOneForm").classList.add("hidden");
    $("#stepTwoForm").classList.remove("hidden");
    $("#nameInput").focus();
  });

  $("#backToStepOne").addEventListener("click", () => {
    $("#stepTwoForm").classList.add("hidden");
    $("#stepOneForm").classList.remove("hidden");
  });

  $("#stepTwoForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = $("#nameInput").value.trim();
    const mobile = $("#mobileInput").value.trim();

    if (!name || mobile.length < 7) {
      showToast("Enter your name and mobile number.");
      return;
    }

    const user = {
      email: state.draftUser.email,
      name,
      mobile,
      passwordSet: true,
      createdAt: new Date().toISOString()
    };

    const token = id("login");
    const loginLink = `${window.location.origin}${window.location.pathname}?verify=${encodeURIComponent(token)}`;
    localStorage.setItem(`${pendingPrefix}${token}`, JSON.stringify({ user, createdAt: Date.now() }));

    const submitButton = $("#stepTwoForm button[type='submit']");
    submitButton.disabled = true;
    submitButton.textContent = "Sending";

    try {
      const response = await fetch("/api/send-login-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, name: user.name, loginLink })
      });
      const data = await response.json();
      showEmailSent(user.email, data.loginLink || loginLink, data.demo || isLocalPreview());
    } catch {
      showEmailSent(user.email, loginLink, true);
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Send link";
    }
  });
}

function showEmailSent(email, link, demo) {
  $("#stepTwoForm").classList.add("hidden");
  $("#emailSentPanel").classList.remove("hidden");
  $("#emailSentText").textContent = `A login link has been prepared for ${email}.`;
  $("#demoLoginLink").href = link;
  $("#demoLoginLink").classList.toggle("hidden", !demo);
}

function showVerifyModal(token) {
  $("#confirmModal").classList.remove("hidden");

  $("#confirmLogin").onclick = () => {
    const pending = read(`${pendingPrefix}${token}`, null);
    if (!pending?.user) {
      showToast("This login link is no longer available.");
      return;
    }

    const firstDevice = !state.user?.email;
    state.user = pending.user;
    state.session = {
      loggedIn: true,
      email: pending.user.email,
      device: getDeviceId(),
      loginAt: new Date().toISOString()
    };
    localStorage.removeItem(`${pendingPrefix}${token}`);
    markAdminLaptop(firstDevice);
    saveState();
    window.history.replaceState({}, "", window.location.pathname);
    $("#confirmModal").classList.add("hidden");
    enterApp();
  };

  $("#cancelLogin").onclick = () => {
    window.history.replaceState({}, "", window.location.pathname);
    $("#confirmModal").classList.add("hidden");
  };
}

function enterApp() {
  $("#authView").classList.add("hidden");
  $("#appShell").classList.remove("hidden");
  $("#sidebarUser").textContent = state.user.name || state.user.email;
  ensureStarterData();
  resetAutoLock();
  renderAll();
}

function ensureStarterData() {
  if (!state.projects.length) {
    state.projects.push({
      id: id("project"),
      name: "Astra_AI workspace",
      goal: "Plan, chat, create images, and co-work from one app.",
      createdAt: new Date().toISOString()
    });
  }

  if (!state.chats.length) {
    const projectId = state.projects[0]?.id || "";
    const chat = {
      id: id("chat"),
      title: "New chat",
      model: state.settings.defaultModel,
      projectId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [
        {
          role: "assistant",
          content: `Hi ${state.user.name || "there"}, I am Aurexis. I am ready to help with your Astra_AI work.`,
          createdAt: new Date().toISOString()
        }
      ]
    };
    state.chats.push(chat);
    state.activeChatId = chat.id;
  }

  if (!state.activeChatId || !state.chats.some((chat) => chat.id === state.activeChatId)) {
    state.activeChatId = state.chats[0].id;
  }

  saveState();
}

function fillModelSelects() {
  const selects = ["#modelSelect", "#defaultModelSelect"];
  for (const selector of selects) {
    const select = $(selector);
    select.innerHTML = "";
    for (const model of modelOptions) {
      const option = document.createElement("option");
      option.value = model.id;
      option.textContent = `${model.name} (${model.id})`;
      select.append(option);
    }
  }
}

function bindApp() {
  $("#themeToggle").addEventListener("click", toggleTheme);
  ["click", "keydown", "submit"].forEach((eventName) => document.addEventListener(eventName, resetAutoLock));

  $$(".nav-button").forEach((button) => {
    button.addEventListener("click", () => switchSection(button.dataset.section));
  });

  $("#logoutButton").addEventListener("click", () => {
    state.session = null;
    localStorage.removeItem(KEYS.session);
    location.reload();
  });

  $("#newChatButton").addEventListener("click", () => {
    const chat = createChat();
    state.activeChatId = chat.id;
    saveState();
    renderAll();
    $("#chatInput").focus();
  });

  $("#modelSelect").addEventListener("change", (event) => {
    const chat = currentChat();
    chat.model = event.target.value;
    chat.updatedAt = new Date().toISOString();
    saveState();
    renderModels();
  });

  $("#chatProjectSelect").addEventListener("change", (event) => {
    const chat = currentChat();
    chat.projectId = event.target.value;
    chat.updatedAt = new Date().toISOString();
    saveState();
    renderChats();
  });

  $("#chatForm").addEventListener("submit", sendChat);
  $("#projectForm").addEventListener("submit", createProject);
  $("#imageForm").addEventListener("submit", createImageFromForm);
  $("#coworkForm").addEventListener("submit", createCoworkNote);
  $("#voiceButton").addEventListener("click", startVoiceMode);
  $("#testOllamaButton").addEventListener("click", testOllamaConnection);

  $("#saveSettingsButton").addEventListener("click", () => {
    state.settings.defaultModel = $("#defaultModelSelect").value;
    state.settings.theme = $("#themeSelect").value;
    state.settings.friendlyMode = $("#friendlyModeInput").checked;
    state.settings.voiceMode = $("#voiceModeInput").checked;
    state.settings.safetyMode = $("#safetyModeInput").checked;
    state.settings.saveMemory = $("#memoryInput").checked;
    state.settings.autoLockMinutes = $("#autoLockInput").value;
    if (!state.settings.saveMemory) {
      localStorage.removeItem(KEYS.chats);
      localStorage.removeItem(KEYS.activeChat);
    }
    saveState();
    applyTheme();
    resetAutoLock();
    showToast("Settings saved.");
  });

  $("#savePaymentButton").addEventListener("click", () => {
    state.settings.paymentLink = $("#paymentLinkInput").value.trim() || state.settings.paymentLink;
    state.settings.paymentStatus = $("#paymentStatusInput").value;
    saveState();
    renderSettings();
    showToast("QR updated.");
  });

  $("#exportDataButton").addEventListener("click", exportData);

  $("#disableAdminButton").addEventListener("click", () => {
    localStorage.removeItem(KEYS.adminDevice);
    renderAll();
    switchSection("chat");
    showToast("Admin hidden on this laptop.");
  });

  $("#clearLocalDataButton").addEventListener("click", () => {
    if (!confirm("Clear saved Astra_AI data on this laptop?")) return;
    Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
    Object.keys(localStorage)
      .filter((key) => key.startsWith(pendingPrefix))
      .forEach((key) => localStorage.removeItem(key));
    location.reload();
  });
}

async function testOllamaConnection() {
  const button = $("#testOllamaButton");
  const result = $("#ollamaTestResult");
  button.disabled = true;
  button.textContent = "Testing";
  result.className = "test-result";
  result.textContent = "Checking Ollama from this deployed app.";

  try {
    const response = await fetch("/api/ollama-status");
    const data = await response.json();
    result.className = `test-result ${data.ok ? "good" : "bad"}`;
    result.textContent = `${data.message} Mode: ${data.mode}. Model: ${data.model}.`;
    $("#ollamaStatus").textContent = data.ok ? "Ollama connected" : "Ollama setup needed";
    $("#ollamaStatus").classList.toggle("accent", !data.ok);
  } catch {
    result.className = "test-result bad";
    result.textContent = "Could not run the Ollama test.";
  } finally {
    button.disabled = false;
    button.textContent = "Test Ollama connection";
  }
}

function switchSection(section) {
  if (section === "admin" && !isAdminLaptop()) {
    showToast("Admin is only available on the registered laptop.");
    return;
  }

  state.activeSection = section;
  $$(".nav-button").forEach((button) => button.classList.toggle("active", button.dataset.section === section));
  $$(".section-view").forEach((view) => view.classList.remove("active"));
  $(`#${section}Section`)?.classList.add("active");
  $("#sectionKicker").textContent = sectionMeta[section][0];
  $("#sectionTitle").textContent = sectionMeta[section][1];
}

function renderAll() {
  $("#adminNav").classList.toggle("hidden", !isAdminLaptop());
  renderModels();
  renderChats();
  renderMessages();
  renderProjects();
  renderImages();
  renderCowork();
  renderSettings();
  renderAdmin();
  switchSection(state.activeSection);
}

function createChat() {
  const projectId = $("#chatProjectSelect")?.value || state.projects[0]?.id || "";
  const chat = {
    id: id("chat"),
    title: "New chat",
    model: state.settings.defaultModel,
    projectId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [
      {
        role: "assistant",
        content: "Fresh chat started. I am here and ready.",
        createdAt: new Date().toISOString()
      }
    ]
  };
  state.chats.unshift(chat);
  return chat;
}

function currentChat() {
  return state.chats.find((chat) => chat.id === state.activeChatId) || state.chats[0];
}

function activeProjectName() {
  const chat = currentChat();
  return state.projects.find((project) => project.id === chat?.projectId)?.name || "Astra_AI";
}

function renderChats() {
  const list = $("#chatList");
  list.innerHTML = "";
  for (const chat of state.chats) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `list-item ${chat.id === state.activeChatId ? "active" : ""}`;
    const title = document.createElement("strong");
    title.textContent = chat.title || "New chat";
    const meta = document.createElement("span");
    meta.textContent = `${chat.model} • ${formatTime(chat.updatedAt)}`;
    button.append(title, meta);
    button.addEventListener("click", () => {
      state.activeChatId = chat.id;
      saveState();
      renderAll();
    });
    list.append(button);
  }

  const projectSelect = $("#chatProjectSelect");
  projectSelect.innerHTML = "";
  for (const project of state.projects) {
    const option = document.createElement("option");
    option.value = project.id;
    option.textContent = project.name;
    projectSelect.append(option);
  }
  projectSelect.value = currentChat()?.projectId || state.projects[0]?.id || "";
}

function renderModels() {
  const chat = currentChat();
  $("#modelSelect").value = chat?.model || state.settings.defaultModel;
  $("#defaultModelSelect").value = state.settings.defaultModel;

  const grid = $("#modelCards");
  grid.innerHTML = "";
  for (const model of modelOptions.slice(0, 6)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `model-card ${chat?.model === model.id ? "active" : ""}`;
    const name = document.createElement("strong");
    name.textContent = model.name;
    const note = document.createElement("span");
    note.textContent = model.note;
    button.append(name, note);
    button.addEventListener("click", () => {
      chat.model = model.id;
      $("#modelSelect").value = model.id;
      saveState();
      renderModels();
    });
    grid.append(button);
  }
}

function renderMessages() {
  const chat = currentChat();
  const list = $("#messageList");
  list.innerHTML = "";

  for (const message of chat.messages) {
    const item = document.createElement("article");
    item.className = `message ${message.role}`;
    const label = document.createElement("small");
    label.textContent = message.role === "user" ? state.user.name || "You" : "Aurexis";
    const text = document.createElement("div");
    text.textContent = message.content;
    item.append(label, text);

    if (message.imageUrl) {
      const image = document.createElement("img");
      image.src = message.imageUrl;
      image.alt = message.content || "Generated image";
      item.append(image);
    }

    list.append(item);
  }

  list.scrollTop = list.scrollHeight;
}

async function sendChat(event) {
  event.preventDefault();
  const input = $("#chatInput");
  const prompt = input.value.trim();
  if (!prompt) return;

  const chat = currentChat();
  appendMessage(chat, "user", prompt);
  if (chat.title === "New chat") {
    chat.title = prompt.slice(0, 46);
  }
  input.value = "";
  renderAll();

  if (looksLikeImagePrompt(prompt)) {
    const loading = appendMessage(chat, "assistant", "Creating your image now.");
    renderMessages();
    const image = await generateImage(prompt, "Cinematic");
    loading.content = "I created this image for you.";
    loading.imageUrl = image.image;
    chat.updatedAt = new Date().toISOString();
    saveState();
    renderAll();
    return;
  }

  const loading = appendMessage(chat, "assistant", "Thinking with Aurexis.");
  renderMessages();

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: chat.model,
        projectName: activeProjectName(),
        friendlyMode: state.settings.friendlyMode,
        safetyMode: state.settings.safetyMode,
        messages: chat.messages.filter((message) => !message.imageUrl).map(({ role, content }) => ({ role, content }))
      })
    });
    const data = await response.json();
    loading.content = data.reply || "I am here. Try sending that once more.";
    $("#ollamaStatus").textContent = data.ok ? "Ollama connected" : "Ollama setup needed";
    $("#ollamaStatus").classList.toggle("accent", !data.ok);
  } catch {
    loading.content = "I could not reach the chat service yet. The app is ready, but the connection needs to be available.";
    $("#ollamaStatus").textContent = "Ollama offline";
    $("#ollamaStatus").classList.add("accent");
  }

  chat.updatedAt = new Date().toISOString();
  saveState();
  renderAll();
}

function startVoiceMode() {
  if (!state.settings.voiceMode) {
    state.settings.voiceMode = true;
    saveState();
    renderSettings();
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast("Voice Mode is not available in this browser yet.");
    return;
  }

  const button = $("#voiceButton");
  const recognition = new SpeechRecognition();
  recognition.lang = navigator.language || "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  button.classList.add("listening");
  recognition.onresult = (event) => {
    const text = event.results?.[0]?.[0]?.transcript || "";
    $("#chatInput").value = text;
    $("#chatInput").focus();
  };
  recognition.onerror = () => showToast("Voice Mode could not hear clearly.");
  recognition.onend = () => button.classList.remove("listening");
  recognition.start();
}

function appendMessage(chat, role, content) {
  const message = {
    role,
    content,
    createdAt: new Date().toISOString()
  };
  chat.messages.push(message);
  chat.updatedAt = new Date().toISOString();
  saveState();
  return message;
}

function looksLikeImagePrompt(prompt) {
  return /^\s*(create|generate|make|draw|paint|imagine|design)\s+(an?\s+)?(image|picture|photo|artwork|poster|logo|illustration)\b/i.test(prompt);
}

function createProject(event) {
  event.preventDefault();
  const name = $("#projectNameInput").value.trim();
  const goal = $("#projectGoalInput").value.trim();
  if (!name) return;

  const project = {
    id: id("project"),
    name,
    goal,
    createdAt: new Date().toISOString()
  };
  state.projects.unshift(project);
  $("#projectForm").reset();
  saveState();
  renderAll();
  showToast("Project created.");
}

function renderProjects() {
  const list = $("#projectList");
  list.innerHTML = "";
  for (const project of state.projects) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "list-item";
    const name = document.createElement("strong");
    name.textContent = project.name;
    const goal = document.createElement("p");
    goal.textContent = project.goal || "No goal added";
    const date = document.createElement("span");
    date.textContent = formatTime(project.createdAt);
    button.append(name, goal, date);
    button.addEventListener("click", () => {
      const chat = createChat();
      chat.projectId = project.id;
      chat.title = project.name;
      state.activeChatId = chat.id;
      saveState();
      renderAll();
      switchSection("chat");
    });
    list.append(button);
  }
}

async function createImageFromForm(event) {
  event.preventDefault();
  const prompt = $("#imagePromptInput").value.trim();
  const style = $("#imageStyleInput").value;
  if (!prompt) {
    showToast("Enter an image prompt.");
    return;
  }

  const button = $("#imageForm button[type='submit']");
  button.disabled = true;
  button.textContent = "Generating";
  await generateImage(prompt, style);
  $("#imagePromptInput").value = "";
  button.disabled = false;
  button.textContent = "Generate image";
  renderImages();
  showToast("Image created.");
}

async function generateImage(prompt, style) {
  try {
    const response = await fetch("/api/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, style })
    });
    const data = await response.json();
    const image = {
      id: id("image"),
      prompt,
      style,
      image: data.image,
      source: data.source || "connected",
      createdAt: new Date().toISOString()
    };
    state.images.unshift(image);
    saveState();
    return image;
  } catch {
    showToast("Image service is not available yet.");
    return { image: "", prompt, style };
  }
}

function renderImages() {
  const gallery = $("#imageGallery");
  gallery.innerHTML = "";
  if (!state.images.length) {
    const empty = document.createElement("p");
    empty.textContent = "Generated images will appear here.";
    gallery.append(empty);
    return;
  }

  for (const item of state.images) {
    const card = document.createElement("article");
    card.className = "image-card";
    const image = document.createElement("img");
    image.src = item.image;
    image.alt = item.prompt;
    const prompt = document.createElement("p");
    prompt.textContent = item.prompt;
    card.append(image, prompt);
    gallery.append(card);
  }
}

function createCoworkNote(event) {
  event.preventDefault();
  const note = $("#coworkNoteInput").value.trim();
  if (!note) return;

  state.cowork.unshift({
    id: id("note"),
    author: state.user.name || state.user.email,
    note,
    createdAt: new Date().toISOString()
  });
  $("#coworkForm").reset();
  saveState();
  renderCowork();
  showToast("Co-work note added.");
}

function renderCowork() {
  const list = $("#coworkList");
  list.innerHTML = "";
  if (!state.cowork.length) {
    const empty = document.createElement("p");
    empty.textContent = "Shared notes will appear here.";
    list.append(empty);
    return;
  }

  for (const note of state.cowork) {
    const item = document.createElement("article");
    item.className = "list-item";
    const author = document.createElement("strong");
    author.textContent = note.author;
    const text = document.createElement("p");
    text.textContent = note.note;
    const time = document.createElement("span");
    time.textContent = formatTime(note.createdAt);
    item.append(author, text, time);
    list.append(item);
  }
}

function renderSettings() {
  const profile = $("#profileDetails");
  profile.innerHTML = "";
  profile.append(
    createDetail("Name", state.user.name),
    createDetail("Email", state.user.email),
    createDetail("Mobile", state.user.mobile),
    createDetail("Login saved", state.session?.loggedIn ? "Yes" : "No")
  );

  $("#defaultModelSelect").value = state.settings.defaultModel;
  $("#themeSelect").value = state.settings.theme;
  $("#friendlyModeInput").checked = Boolean(state.settings.friendlyMode);
  $("#voiceModeInput").checked = Boolean(state.settings.voiceMode);
  $("#safetyModeInput").checked = Boolean(state.settings.safetyMode);
  $("#memoryInput").checked = Boolean(state.settings.saveMemory);
  $("#autoLockInput").value = String(state.settings.autoLockMinutes ?? "0");
  $("#paymentLinkInput").value = state.settings.paymentLink;
  $("#paymentStatusInput").value = state.settings.paymentStatus || "not-paid";
  $("#paymentQr").src = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(state.settings.paymentLink)}`;
  $("#paymentButton").href = state.settings.paymentLink;
  $("#planStatus").textContent = state.settings.paymentStatus === "paid" ? "Pro active" : "$25/year Pro";
  $("#voiceButton").classList.toggle("active", Boolean(state.settings.voiceMode));
}

function renderAdmin() {
  const stats = $("#adminStats");
  stats.innerHTML = "";
  stats.append(
    createDetail("Admin laptop", isAdminLaptop() ? "Yes" : "No"),
    createDetail("Registered user", state.user.email),
    createDetail("Chats", String(state.chats.length)),
    createDetail("Projects", String(state.projects.length)),
    createDetail("Images", String(state.images.length)),
    createDetail("Co-work notes", String(state.cowork.length))
  );
}

function exportData() {
  const payload = {
    exportedAt: new Date().toISOString(),
    user: state.user,
    chats: state.chats,
    projects: state.projects,
    images: state.images.map(({ image, ...item }) => ({
      ...item,
      image: image?.startsWith("data:") ? "embedded image data" : image
    })),
    cowork: state.cowork,
    settings: state.settings
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `astra-ai-export-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

boot();
