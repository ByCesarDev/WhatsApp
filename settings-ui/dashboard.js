const invoke = window.__TAURI__.core.invoke;

const AVATAR_COLORS = [
  "#25D366", // WhatsApp Green
  "#00a884", // Teal
  "#3b82f6", // Blue
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#f59e0b", // Amber
  "#06b6d4", // Cyan
  "#10b981", // Emerald
];

function getColorForName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

function getInitials(name) {
  if (!name) return "W";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

async function hideDashboard() {
  try {
    const win =
      window.__TAURI__?.window?.getCurrentWindow?.() ||
      window.__TAURI__?.webviewWindow?.getCurrentWebviewWindow?.();
    if (win && typeof win.hide === "function") {
      await win.hide();
    }
  } catch (e) {
    console.error("Could not hide dashboard window:", e);
  }
}

async function selectAccount(id) {
  try {
    await invoke("open_account", { id });
    await hideDashboard();
  } catch (e) {
    await Dlg.alert(String(e), { title: "Error al abrir la cuenta" });
  }
}

async function renderAccounts() {
  const grid = document.getElementById("accounts-grid");
  grid.innerHTML = "";

  try {
    const accounts = await invoke("list_accounts");
    if (!accounts || accounts.length === 0) {
      grid.innerHTML = `<p class="dash-subtitle" style="text-align:center; padding: 20px;">No hay cuentas configuradas</p>`;
      return;
    }

    for (const acct of accounts) {
      const card = document.createElement("div");
      card.className = "account-card";
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");

      const avatar = document.createElement("div");
      avatar.className = "account-avatar";
      avatar.style.backgroundColor = getColorForName(acct.name);
      avatar.textContent = getInitials(acct.name);

      const info = document.createElement("div");
      info.className = "account-info";

      const name = document.createElement("div");
      name.className = "account-name";
      name.textContent = acct.name;

      const status = document.createElement("div");
      status.className = "account-status";
      status.textContent = "Haz clic para abrir";

      info.appendChild(name);
      info.appendChild(status);

      card.appendChild(avatar);
      card.appendChild(info);

      if (acct.unread > 0) {
        const badge = document.createElement("div");
        badge.className = "account-badge";
        badge.textContent = `${acct.unread} ${acct.unread === 1 ? "nuevo" : "nuevos"}`;
        card.appendChild(badge);
      }

      card.addEventListener("click", () => selectAccount(acct.id));
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectAccount(acct.id);
        }
      });

      grid.appendChild(card);
    }
  } catch (e) {
    grid.innerHTML = `<p class="dash-subtitle" style="color:#ef4444; text-align:center;">Error al cargar cuentas: ${e}</p>`;
  }
}

async function checkLockStatus() {
  try {
    const status = await invoke("get_lock_status");
    const lockBtn = document.getElementById("lock-btn");
    if (status && status.enabled) {
      lockBtn.hidden = false;
      lockBtn.addEventListener("click", async () => {
        await invoke("lock_app");
      });
    }
  } catch (e) {
    // Lock not available or error
  }
}

async function init() {
  await renderAccounts();
  await checkLockStatus();

  document.getElementById("add-account-btn").addEventListener("click", async () => {
    const name = await Dlg.prompt("", {
      title: "Nueva cuenta de WhatsApp",
      placeholder: "Ej. Personal, Trabajo, Ventas",
      okLabel: "Crear y abrir",
      requiredMessage: "Debes ingresar un nombre para la cuenta.",
    });
    if (!name || !name.trim()) return;

    try {
      const acct = await invoke("add_account", { name: name.trim() });
      await selectAccount(acct.id);
    } catch (e) {
      await Dlg.alert(String(e), { title: "No se pudo crear la cuenta" });
    }
  });

  document.getElementById("settings-btn").addEventListener("click", async () => {
    await invoke("open_settings");
  });

  // Re-render when window gains focus in case an account was added/modified
  window.addEventListener("focus", () => {
    renderAccounts();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
