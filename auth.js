// Handles account signup/login and syncs the planner's saved state (normally
// just localStorage) to a per-user row in Supabase, so each person's plan
// follows their account instead of staying stuck in one browser.
const STORAGE_KEY = "mcat-prep-plan-v1";
const PLANS_TABLE = "plans";

const supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

let currentUser = null;
let appScriptLoaded = false;
let syncTimer = null;

const authScreen = document.querySelector("#auth-screen");
const appEl = document.querySelector("#app");
const appNav = document.querySelector("#app-nav");
const accountBar = document.querySelector("#account-bar");
const accountEmail = document.querySelector("#account-email");
const syncStatus = document.querySelector("#sync-status");
const authForm = document.querySelector("#auth-form");
const authEmail = document.querySelector("#auth-email");
const authPassword = document.querySelector("#auth-password");
const authSubmit = document.querySelector("#auth-submit");
const authToggle = document.querySelector("#auth-toggle");
const authMessage = document.querySelector("#auth-message");
let authMode = "signin";

// Namespace the planner's localStorage key per signed-in user and mirror
// writes to Supabase, without needing to touch app.js at all.
const nativeGetItem = Storage.prototype.getItem;
const nativeSetItem = Storage.prototype.setItem;
Storage.prototype.getItem = function (key) {
  if (this === window.localStorage && key === STORAGE_KEY && currentUser) {
    return nativeGetItem.call(this, `${STORAGE_KEY}::${currentUser.id}`);
  }
  return nativeGetItem.call(this, key);
};
Storage.prototype.setItem = function (key, value) {
  if (this === window.localStorage && key === STORAGE_KEY && currentUser) {
    nativeSetItem.call(this, `${STORAGE_KEY}::${currentUser.id}`, value);
    queueCloudSync(value);
    return;
  }
  return nativeSetItem.call(this, key, value);
};

function queueCloudSync(value) {
  setSyncStatus("Saving...");
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => pushToCloud(value), 800);
}

async function pushToCloud(value) {
  if (!currentUser) return;
  const { error } = await supabaseClient.from(PLANS_TABLE).upsert({
    user_id: currentUser.id,
    data: JSON.parse(value),
    updated_at: new Date().toISOString()
  });
  setSyncStatus(error ? "Saved locally (sync failed)" : "Saved to your account");
  if (error) console.error("Cloud sync failed", error);
}

async function pullFromCloud() {
  const { data, error } = await supabaseClient.from(PLANS_TABLE).select("data").eq("user_id", currentUser.id).maybeSingle();
  if (error) { console.error("Cloud load failed", error); return; }
  if (data?.data) {
    nativeSetItem.call(window.localStorage, `${STORAGE_KEY}::${currentUser.id}`, JSON.stringify(data.data));
    return;
  }
  // No cloud plan yet for this account: adopt any pre-login plan sitting in this browser instead of starting blank.
  const legacyPlan = nativeGetItem.call(window.localStorage, STORAGE_KEY);
  if (legacyPlan) {
    nativeSetItem.call(window.localStorage, `${STORAGE_KEY}::${currentUser.id}`, legacyPlan);
    await pushToCloud(legacyPlan);
  }
}

function setSyncStatus(text) { if (syncStatus) syncStatus.textContent = text; }

function loadPlannerApp() {
  if (appScriptLoaded) { location.reload(); return; }
  appScriptLoaded = true;
  const script = document.createElement("script");
  script.src = "app.js";
  document.body.appendChild(script);
}

function showApp() {
  authScreen.classList.add("hidden");
  appEl.classList.remove("hidden");
  appNav.classList.remove("hidden");
  accountBar.classList.remove("hidden");
  accountEmail.textContent = currentUser.email;
  setSyncStatus("Saved to your account");
}

function showAuthScreen() {
  authScreen.classList.remove("hidden");
  appEl.classList.add("hidden");
  appNav.classList.add("hidden");
  accountBar.classList.add("hidden");
}

async function handleSession(session) {
  if (session?.user) {
    currentUser = session.user;
    await pullFromCloud();
    showApp();
    loadPlannerApp();
  } else {
    currentUser = null;
    showAuthScreen();
  }
}

function setAuthMode(mode) {
  authMode = mode;
  authMessage.textContent = "";
  if (mode === "signup") {
    authSubmit.textContent = "Sign up";
    authToggle.textContent = "Already have an account? Sign in";
  } else {
    authSubmit.textContent = "Sign in";
    authToggle.textContent = "Need an account? Sign up";
  }
}

authToggle.addEventListener("click", () => setAuthMode(authMode === "signin" ? "signup" : "signin"));

authForm.addEventListener("submit", async event => {
  event.preventDefault();
  authSubmit.disabled = true;
  authMessage.textContent = "";
  const email = authEmail.value.trim();
  const password = authPassword.value;
  try {
    if (authMode === "signup") {
      const { data, error } = await supabaseClient.auth.signUp({ email, password });
      if (error) throw error;
      if (!data.session) authMessage.textContent = "Check your email to confirm your account, then sign in.";
    } else {
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
  } catch (error) {
    authMessage.textContent = error.message || "Something went wrong. Try again.";
  } finally {
    authSubmit.disabled = false;
  }
});

document.querySelector("#sign-out").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  location.reload();
});

supabaseClient.auth.onAuthStateChange((_event, session) => { if (!appScriptLoaded) handleSession(session); });
supabaseClient.auth.getSession().then(({ data }) => handleSession(data.session));
