/* =========================================================================
   0. CONFIG — fill these in with your own Supabase project's values.
   Find them in: Supabase Dashboard → Project Settings → API
   ========================================================================= */
const SUPABASE_URL = "https://rsxbortronrhtdwlvwao.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzeGJvcnRyb25yaHRkd2x2d2FvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxNjY0NTcsImV4cCI6MjEwNDc0MjQ1N30.cVemoSdCmpxV22YMJQCFukAZstQnNUx4dEli9TXefZQ";

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* =========================================================================
   1. SMALL SHARED HELPERS
   ========================================================================= */
async function getMyProfile() {
  const {
    data: { session },
  } = await sb.auth.getSession();
  if (!session) return null;
  const { data, error } = await sb
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();
  if (error) {
    console.error(error);
    return null;
  }
  return data;
}

async function logout() {
  await sb.auth.signOut();
  navigate("/login");
}

function toast(message, type = "") {
  let el = document.getElementById("__toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "__toast";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.className = "toast show" + (type ? " " + type : "");
  clearTimeout(el._timer);
  el._timer = setTimeout(() => {
    el.classList.remove("show");
  }, 3200);
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatCountdown(totalSeconds) {
  if (totalSeconds < 0) totalSeconds = 0;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatDurationShort(seconds) {
  if (seconds == null) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function renderMath(root) {
  if (!root) return;
  const run = () => {
    if (typeof renderMathInElement !== "function") return setTimeout(run, 100);
    try {
      renderMathInElement(root, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "\\[", right: "\\]", display: true },
          { left: "$", right: "$", display: false },
          { left: "\\(", right: "\\)", display: false },
        ],
        throwOnError: false,
        strict: "ignore",
      });
    } catch (_) {}
  };
  run();
}

function normaliseImageUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (!["https:", "http:"].includes(url.protocol)) return null;
    const match =
      url.hostname.includes("drive.google.com") &&
      (url.pathname.match(/\/d\/([^/]+)/) || url.searchParams.get("id"));
    const id = Array.isArray(match) ? match[1] : match;
    return id
      ? `https://drive.google.com/uc?export=view&id=${encodeURIComponent(id)}`
      : url.href;
  } catch (_) {
    return null;
  }
}

function questionImageHtml(url) {
  const safeUrl = normaliseImageUrl(url);
  return safeUrl
    ? `<div class="question-image"><img src="${escapeHtml(safeUrl)}" alt="Question diagram" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.innerHTML='<div class=&quot;image-fallback&quot;>This question image could not be loaded. Please report it.</div>'"></div>`
    : "";
}

async function uploadQuestionImage(file) {
  if (!file) return null;
  if (!file.type.startsWith("image/"))
    throw new Error("Please choose an image file.");
  if (file.size > 5 * 1024 * 1024)
    throw new Error("Image must be 5 MB or smaller.");
  const extension = (file.name.split(".").pop() || "png")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const unique = crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  const path = `${currentTest.id}/${Date.now()}-${unique}.${extension || "png"}`;
  const { data, error } = await sb.storage
    .from("question-images")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });
  if (error) throw error;
  const { data: publicUrl } = sb.storage
    .from("question-images")
    .getPublicUrl(data.path);
  return publicUrl.publicUrl;
}

function friendlyError(err) {
  if (!err) return "Something went wrong. Please try again.";
  const msg = err.message || String(err);
  return msg.replace(/^.*?:\s*/, "");
}

// Precise, exact-to-the-second duration, e.g. "1h 4m 32s", "6m 8s", "42s"
function formatDurationPrecise(seconds) {
  if (seconds == null || isNaN(seconds)) return "—";
  seconds = Math.max(0, Math.floor(seconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (h > 0) parts.push(h + "h");
  if (h > 0 || m > 0) parts.push(m + "m");
  parts.push(s + "s");
  return parts.join(" ");
}

// Consistent colour identity for each subject/category, used as small badges
// and accents throughout the app so students can visually tell them apart at a glance.
const SUBJECT_COLORS = {
  Physics: "#2451B0",
  Chemistry: "#1C8A5A",
  Mathematics: "#B15B00",
  Biology: "#B1305B",
};
function subjectColor(subject) {
  return SUBJECT_COLORS[subject] || "#5B6478";
}
function subjectDot(subject) {
  return `<span class="subject-dot" style="background:${subjectColor(subject)}"></span>`;
}

const CATEGORY_COLORS = {
  "JEE Main": ["#EAF0FB", "#193A85"],
  "JEE Advanced": ["#F1ECFC", "#5B2FBD"],
  NEET: ["#E5F5EE", "#1C8A5A"],
  "Class 9th": ["#FFF3E0", "#B15B00"],
  "Class 10th": ["#FFF3E0", "#B15B00"],
  "Class 11th": ["#FDECEF", "#B1305B"],
  "Class 12th": ["#FDECEF", "#B1305B"],
};
function categoryBadge(category) {
  const [bg, fg] = CATEGORY_COLORS[category] || ["#EEF0F3", "#5B6478"];
  return `<span class="status-tag" style="background:${bg};color:${fg};">${escapeHtml(category || "Other")}</span>`;
}

/* =========================================================================
   2. ROUTER — this is a single HTML page; different "views" are just
   sections toggled on/off, and the URL hash carries the route + params,
   e.g. #/exam?code=ABC123  or  #/result?attempt=<uuid>
   ========================================================================= */
const VIEWS = ["landing", "auth", "dashboard", "admin-test", "exam", "result"];
let currentRoute = { path: "/login", params: new URLSearchParams() };

// Set to true while a student is actively inside a running exam, so they
// can't accidentally navigate away (hash edit / back button) mid-test.
let examLocked = false;
let lastExamHash = "/exam";

function parseHash() {
  let raw = window.location.hash.slice(1);
  if (!raw) raw = "/";
  const qIndex = raw.indexOf("?");
  const path = qIndex === -1 ? raw : raw.slice(0, qIndex);
  const query = qIndex === -1 ? "" : raw.slice(qIndex + 1);
  return {
    path: path.startsWith("/") ? path : "/" + path,
    params: new URLSearchParams(query),
  };
}

function navigate(pathWithQuery) {
  window.location.hash = pathWithQuery;
}

function qs(name) {
  return currentRoute.params.get(name);
}

function showView(name) {
  VIEWS.forEach((v) =>
    document.getElementById("view-" + v).classList.toggle("active", v === name),
  );
}

async function router() {
  const parsed = parseHash();

  // Supabase silently re-fires auth-state changes on things like the tab
  // regaining focus — which happens right after a tab-switch violation
  // warning — and that calls router() again even though the route never
  // changed. If a test is already running, treat that as a no-op instead
  // of re-running enterExamView() and wiping out progress / reopening the
  // instructions modal mid-test.
  if (examStarted && !submitted && parsed.path === "/exam") {
    currentRoute = parsed;
    return;
  }

  if (examLocked && parsed.path !== "/exam") {
    toast("Finish or submit your test before leaving this page.", "error");
    window.location.hash = lastExamHash;
    return;
  }

  currentRoute = parsed;

  const {
    data: { session },
  } = await sb.auth.getSession();

  if (!session) {
    // Landing-page section hashes are anchors, not application routes.
    if (parsed.path.startsWith("/lp-")) {
      showView("landing");
      requestAnimationFrame(() => {
        document.getElementById(parsed.path.slice(1))?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
      return;
    }
    // Public, signed-out visitors land on the marketing page first; only an
    // explicit "/login" request (e.g. the Participate buttons) — or a deep
    // link to a page that requires a session — opens the existing auth view.
    if (parsed.path === "/" || parsed.path === "/landing") {
      showView("landing");
    } else {
      showView("auth");
    }
    return;
  }

  if (parsed.path === "/login" || parsed.path === "/" || parsed.path === "/landing") {
    navigate("/dashboard");
    return;
  }

  switch (parsed.path) {
    case "/dashboard":
      showView("dashboard");
      await enterDashboardView();
      break;
    case "/admin-test":
      showView("admin-test");
      await enterAdminTestView();
      break;
    case "/exam":
      lastExamHash =
        "/exam" +
        (parsed.params.toString() ? "?" + parsed.params.toString() : "");
      showView("exam");
      await enterExamView();
      break;
    case "/result":
      showView("result");
      await enterResultView();
      break;
    default:
      navigate("/dashboard");
  }
}

window.addEventListener("hashchange", router);
sb.auth.onAuthStateChange(() => {
  router();
});

/* =========================================================================
   3. AUTH VIEW
   ========================================================================= */
function setupAuthListeners() {
  const tabLoginBtn = document.getElementById("tabLoginBtn");
  const tabSignupBtn = document.getElementById("tabSignupBtn");
  const loginForm = document.getElementById("loginForm");
  const signupForm = document.getElementById("signupForm");
  const authMessage = document.getElementById("authMessage");

  document.querySelectorAll(".password-toggle").forEach((btn) =>
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.passwordTarget);
      const visible = input.type === "text";
      input.type = visible ? "password" : "text";
      btn.setAttribute(
        "aria-label",
        visible ? "Show password" : "Hide password",
      );
      btn.setAttribute("aria-pressed", String(!visible));
      btn.textContent = visible ? "👁️" : "🙈";
    }),
  );

  function showTab(tab) {
    authMessage.innerHTML = "";
    if (tab === "login") {
      tabLoginBtn.classList.add("active");
      tabSignupBtn.classList.remove("active");
      loginForm.style.display = "block";
      signupForm.style.display = "none";
    } else {
      tabLoginBtn.classList.remove("active");
      tabSignupBtn.classList.add("active");
      loginForm.style.display = "none";
      signupForm.style.display = "block";
    }
  }
  tabLoginBtn.addEventListener("click", () => showTab("login"));
  tabSignupBtn.addEventListener("click", () => showTab("signup"));

  function setMessage(html, kind) {
    authMessage.innerHTML = `<div class="${kind === "error" ? "error-box" : "success-box"}">${html}</div>`;
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("loginBtn");
    btn.disabled = true;
    btn.textContent = "Logging in…";
    authMessage.innerHTML = "";

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    const { error } = await sb.auth.signInWithPassword({ email, password });

    if (error) {
      setMessage(escapeHtml(friendlyError(error)), "error");
      btn.disabled = false;
      btn.textContent = "Log in";
      return;
    }
    btn.disabled = false;
    btn.textContent = "Log in";
    navigate("/dashboard");
  });

  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("signupBtn");
    btn.disabled = true;
    btn.textContent = "Creating account…";
    authMessage.innerHTML = "";

    const full_name = document.getElementById("signupName").value.trim();
    const email = document.getElementById("signupEmail").value.trim();
    const password = document.getElementById("signupPassword").value;

    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { full_name } },
    });

    btn.disabled = false;
    btn.textContent = "Create account";

    if (error) {
      setMessage(escapeHtml(friendlyError(error)), "error");
      return;
    }
    if (data.session) {
      navigate("/dashboard");
      return;
    }
    setMessage(
      "Account created. Check your email to confirm your address, then log in.",
      "success",
    );
    showTab("login");
  });
}

/* =========================================================================
   4. DASHBOARD VIEW
   ========================================================================= */
let myProfile = null;

function setupDashboardListeners() {
  document.getElementById("segStudent").addEventListener("click", () => {
    document.getElementById("segStudent").classList.add("active");
    document.getElementById("segAdmin").classList.remove("active");
    document.getElementById("studentSection").style.display = "block";
    document.getElementById("adminSection").style.display = "none";
  });
  document.getElementById("segAdmin").addEventListener("click", () => {
    document.getElementById("segAdmin").classList.add("active");
    document.getElementById("segStudent").classList.remove("active");
    document.getElementById("studentSection").style.display = "none";
    document.getElementById("adminSection").style.display = "block";
  });
  document.getElementById("joinForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const code = document.getElementById("joinCode").value.trim().toUpperCase();
    if (!code) return;
    navigate(`/exam?code=${encodeURIComponent(code)}`);
  });
}

async function enterDashboardView() {
  myProfile = await getMyProfile();
  const {
    data: { session },
  } = await sb.auth.getSession();
  document.getElementById("userName").textContent =
    myProfile?.full_name || session.user.email;

  // reset segmented state to a known default each time we arrive here
  document.getElementById("segStudent").classList.add("active");
  document.getElementById("segAdmin").classList.remove("active");
  document.getElementById("studentSection").style.display = "block";
  document.getElementById("adminSection").style.display = "none";
  document.getElementById("joinCode").value = "";
  document.getElementById("joinPreviewSlot").innerHTML = "";

  const roleChip = document.getElementById("roleChip");
  roleChip.className = "role-chip";
  if (myProfile?.role === "admin") {
    roleChip.textContent = "Admin";
    roleChip.classList.add("admin");
    document.getElementById("adminSegmentWrap").style.display = "block";
  } else {
    roleChip.textContent = "Student";
    document.getElementById("adminSegmentWrap").style.display = "none";
  }

  await handleCodeInUrl();
  await loadMyAttempts();
  if (myProfile?.role === "admin") await loadAdminTests();
}

async function handleCodeInUrl() {
  const code = qs("code");
  const slot = document.getElementById("joinPreviewSlot");
  if (!code) return;

  document.getElementById("joinCode").value = code.toUpperCase();

  const { data, error } = await sb
    .from("tests")
    .select(
      "title, description, category, duration_minutes, available_from, available_until, is_published",
    )
    .eq("test_code", code.toUpperCase())
    .maybeSingle();

  if (error || !data || !data.is_published) {
    slot.innerHTML = `<div class="error-box">No published test was found for code <strong>${escapeHtml(code.toUpperCase())}</strong>. Double check the link with your admin.</div>`;
    return;
  }

  slot.innerHTML = `
    <div class="card" style="border-color: var(--brand);">
      <div class="section-title"><h2 style="font-size:16px;">${escapeHtml(data.title)}</h2><span class="flex gap-8">${categoryBadge(data.category)}<span class="status-tag published">Test found</span></span></div>
      ${data.description ? `<p class="text-muted">${escapeHtml(data.description)}</p>` : ""}
      <p class="list-row-meta">Duration once started: ${data.duration_minutes} minutes &nbsp;·&nbsp; Open: ${formatDateTime(data.available_from)} → ${formatDateTime(data.available_until)}</p>
      <button class="btn btn-primary mt-8" id="startFromPreviewBtn">Start test</button>
    </div>
  `;
  document
    .getElementById("startFromPreviewBtn")
    .addEventListener("click", () => {
      navigate(`/exam?code=${encodeURIComponent(code.toUpperCase())}`);
    });
}

async function loadMyAttempts() {
  const list = document.getElementById("attemptsList");
  const { data, error } = await sb
    .from("test_attempts")
    .select(
      "id, status, total_score, started_at, submitted_at, tests(id, title, test_code, duration_minutes, category)",
    )
    .eq("user_id", myProfile.id)
    .order("started_at", { ascending: false });

  if (error) {
    list.innerHTML = `<div class="error-box">${escapeHtml(friendlyError(error))}</div>`;
    return;
  }
  if (!data || data.length === 0) {
    list.innerHTML = `<div class="empty-state">You haven't joined any test yet. Enter a code above to begin.</div>`;
    return;
  }

  list.innerHTML = data
    .map((a) => {
      const t = a.tests;
      const actionHtml =
        a.status === "in_progress"
          ? `<a class="btn btn-primary btn-sm" href="#/exam?code=${encodeURIComponent(t.test_code)}">Resume</a>`
          : `<a class="btn btn-sm" href="#/result?attempt=${a.id}">View report</a>`;
      return `
      <div class="list-row">
        <div class="list-row-main">
          <div class="list-row-title">${escapeHtml(t.title)} ${categoryBadge(t.category)}</div>
          <div class="list-row-meta">Started ${formatDateTime(a.started_at)} · <span class="status-tag ${a.status}">${a.status.replace("_", " ")}</span>${a.status !== "in_progress" ? ` · Score: ${a.total_score}` : ""}</div>
        </div>
        <div class="list-row-actions">${actionHtml}</div>
      </div>
    `;
    })
    .join("");
}

async function loadAdminTests() {
  const list = document.getElementById("adminTestsList");
  const { data, error } = await sb
    .from("tests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    list.innerHTML = `<div class="error-box">${escapeHtml(friendlyError(error))}</div>`;
    return;
  }
  if (!data || data.length === 0) {
    list.innerHTML = `<div class="empty-state">No tests have been created yet.</div>`;
    return;
  }

  const counts = await Promise.all(
    data.map((t) =>
      sb
        .from("test_attempts")
        .select("id", { count: "exact", head: true })
        .eq("test_id", t.id),
    ),
  );

  list.innerHTML = data
    .map((t, i) => {
      const link = `${window.location.origin}${window.location.pathname}#/dashboard?code=${t.test_code}`;
      const attemptCount = counts[i]?.count ?? 0;
      return `
      <div class="list-row">
        <div class="list-row-main">
          <div class="list-row-title">${escapeHtml(t.title)} ${categoryBadge(t.category)}</div>
          <div class="list-row-meta">
            Code: <strong>${t.test_code}</strong> · <span class="status-tag ${t.is_published ? "published" : "draft"}">${t.is_published ? "Published" : "Draft"}</span>
            · ${attemptCount} attempt${attemptCount === 1 ? "" : "s"} · Duration ${t.duration_minutes}m
          </div>
        </div>
        <div class="list-row-actions">
          <button class="btn btn-sm js-copy-link" data-link="${escapeHtml(link)}">Copy link</button>
          <a class="btn btn-primary btn-sm" href="#/admin-test?test=${t.id}">Manage</a>
          <button class="btn btn-sm btn-danger js-delete-test" data-id="${t.id}">Delete</button>
        </div>
      </div>
    `;
    })
    .join("");

  list.querySelectorAll(".js-copy-link").forEach((btn) => {
    btn.addEventListener("click", () => {
      navigator.clipboard
        .writeText(btn.dataset.link)
        .then(() => toast("Link copied"));
    });
  });
  list
    .querySelectorAll(".js-delete-test")
    .forEach((btn) =>
      btn.addEventListener("click", () => deleteTest(btn.dataset.id)),
    );
}

async function deleteTest(id) {
  if (
    !confirm(
      "Delete this test, its questions, attempts, reports, and leaderboard entries? This cannot be undone.",
    )
  )
    return;
  const { error } = await sb.rpc("admin_delete_test", { p_test_id: id });
  if (error) {
    toast(friendlyError(error), "error");
    return;
  }
  toast("Test deleted");
  await loadAdminTests();
}

/* =========================================================================
   5. ADMIN TEST MANAGER VIEW
   ========================================================================= */
let currentTest = null;
let questionCounter = 0;
let editingQuestionId = null;
let editingQuestionImageUrl = null;

function toLocalInputValue(isoOrDate) {
  const d = new Date(isoOrDate);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// One combined "as students will see it" preview — covers the question
// text, every option, and the explanation, all with maths rendered. Lives
// below the form and updates on every keystroke/change.
function updateQuestionPreview() {
  const preview = document.getElementById("questionLivePreview");
  if (!preview) return;

  const subject = document.getElementById("subjectInput").value;
  const type = document.getElementById("typeInput").value;
  const questionText = document
    .getElementById("questionTextInput")
    .value.trim();
  const explanation = document.getElementById("explanationInput").value.trim();
  const positiveMarks = document.getElementById("positiveMarksInput").value;
  const negativeMarks = document.getElementById("negativeMarksInput").value;

  if (!questionText && !subject) {
    preview.innerHTML = `<div class="preview-empty">Start typing above — your question will appear here exactly as students will see it, with maths rendered.</div>`;
    return;
  }

  let bodyHtml;
  if (type === "mcq") {
    const correctOption = document.getElementById("correctOptionInput").value;
    const letters = ["A", "B", "C", "D"];
    const opts = letters
      .map((id) => ({
        id,
        text: document.getElementById("opt" + id).value.trim(),
      }))
      .filter((o) => o.text);
    bodyHtml = opts.length
      ? `<div class="option-list">` +
        opts
          .map(
            (o) => `
          <div class="option-item ${o.id === correctOption ? "review-correct" : ""}">
            <span class="option-letter">${o.id}</span>
            <span class="option-text">${escapeHtml(o.text)}</span>
            ${o.id === correctOption ? `<span class="status-tag published" style="margin-left:auto;">Correct</span>` : ""}
          </div>
        `,
          )
          .join("") +
        `</div>`
      : `<div class="preview-empty-inline">No options entered yet.</div>`;
  } else {
    const val = document.getElementById("correctIntegerInput").value;
    bodyHtml = `<p style="font-size:14px;margin:0;"><span style="color:var(--success);font-weight:650;">Correct answer: ${val !== "" ? escapeHtml(val) : "—"}</span></p>`;
  }

  preview.innerHTML = `
    <div class="question-meta">
      <span class="question-number-badge">${subject ? subjectDot(subject) + escapeHtml(subject) : `<span class="preview-empty-inline">No subject selected</span>`}</span>
      <span class="question-marks">+${positiveMarks || 0} / -${negativeMarks || 0}</span>
    </div>
    <div class="question-text">${questionText ? escapeHtml(questionText) : `<span class="preview-empty-inline">Question text will appear here…</span>`}</div>
    ${bodyHtml}
    ${explanation ? `<div class="explanation-box mt-8"><strong>Explanation:</strong> ${escapeHtml(explanation)}</div>` : ""}
  `;
  renderMath(preview);
}

function setupAdminTestListeners() {
  document.getElementById("typeInput").addEventListener("change", (e) => {
    const isMcq = e.target.value === "mcq";
    document.getElementById("mcqFields").style.display = isMcq
      ? "block"
      : "none";
    document.getElementById("integerFields").style.display = isMcq
      ? "none"
      : "block";
    updateQuestionPreview();
  });
  // One unified live preview reflecting the question exactly as a student
  // will see it — question text, every option, and the explanation all
  // render maths, instead of a preview limited to the question text alone.
  [
    "subjectInput",
    "questionTextInput",
    "optA",
    "optB",
    "optC",
    "optD",
    "correctOptionInput",
    "correctIntegerInput",
    "explanationInput",
    "positiveMarksInput",
    "negativeMarksInput",
  ].forEach((id) => {
    const el = document.getElementById(id);
    el.addEventListener("input", updateQuestionPreview);
    el.addEventListener("change", updateQuestionPreview);
  });
  document.getElementById("imageFileInput").addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    const box = document.getElementById("imagePreview");
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
      e.target.value = "";
      toast(
        !file.type.startsWith("image/")
          ? "Choose an image file."
          : "Image must be 5 MB or smaller.",
        "error",
      );
      return;
    }
    box.hidden = false;
    box.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="Selected image preview">`;
  });

  document
    .getElementById("testDetailsForm")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("saveDetailsBtn");
      btn.disabled = true;

      const payload = {
        title: document.getElementById("titleInput").value.trim(),
        description: document.getElementById("descInput").value.trim() || null,
        category: document.getElementById("categoryInput").value,
        duration_minutes: parseInt(
          document.getElementById("durationInput").value,
          10,
        ),
        available_from: new Date(
          document.getElementById("fromInput").value,
        ).toISOString(),
        available_until: new Date(
          document.getElementById("untilInput").value,
        ).toISOString(),
      };

      if (
        new Date(payload.available_until) <= new Date(payload.available_from)
      ) {
        toast("Closing time must be after the opening time", "error");
        btn.disabled = false;
        return;
      }

      if (currentTest) {
        const { data, error } = await sb
          .from("tests")
          .update(payload)
          .eq("id", currentTest.id)
          .select()
          .single();
        btn.disabled = false;
        if (error) {
          toast(friendlyError(error), "error");
          return;
        }
        currentTest = data;
        toast("Test details saved", "success");
      } else {
        const { data, error } = await sb
          .from("tests")
          .insert({ ...payload, created_by: myProfile.id })
          .select()
          .single();
        btn.disabled = false;
        if (error) {
          toast(friendlyError(error), "error");
          return;
        }
        currentTest = data;
        navigate(`/admin-test?test=${data.id}`);
        document.getElementById("detailsTitle").textContent = "Test details";
        document.getElementById("saveDetailsBtn").textContent = "Save changes";
        toast("Test created — now add some questions", "success");
        showPostCreateSections();
        await loadQuestions();
        await loadStudentResults();
        await loadLeaderboard();
        await loadReports();
      }
    });

  document
    .getElementById("questionForm")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("addQuestionBtn");
      btn.disabled = true;

      const subject = document.getElementById("subjectInput").value.trim();
      const type = document.getElementById("typeInput").value;
      const question_text = document
        .getElementById("questionTextInput")
        .value.trim();
      let image_url = editingQuestionImageUrl;
      const imageFile = document.getElementById("imageFileInput").files?.[0];
      try {
        if (imageFile) image_url = await uploadQuestionImage(imageFile);
      } catch (uploadError) {
        toast(friendlyError(uploadError), "error");
        btn.disabled = false;
        return;
      }
      const explanation =
        document.getElementById("explanationInput").value.trim() || null;
      const positive_marks = parseFloat(
        document.getElementById("positiveMarksInput").value,
      );
      const negative_marks = parseFloat(
        document.getElementById("negativeMarksInput").value,
      );

      let options = null,
        correct_option = null,
        correct_integer_value = null;

      if (type === "mcq") {
        const letters = ["A", "B", "C", "D"];
        const texts = [
          document.getElementById("optA").value.trim(),
          document.getElementById("optB").value.trim(),
          document.getElementById("optC").value.trim(),
          document.getElementById("optD").value.trim(),
        ];
        options = letters
          .map((id, i) => ({ id, text: texts[i] }))
          .filter((o) => o.text);
        correct_option = document.getElementById("correctOptionInput").value;
        if (options.length < 2) {
          toast("Add at least two options", "error");
          btn.disabled = false;
          return;
        }
        if (!options.some((o) => o.id === correct_option)) {
          toast("Correct option must have text", "error");
          btn.disabled = false;
          return;
        }
      } else {
        const val = document.getElementById("correctIntegerInput").value;
        if (val === "") {
          toast("Enter the correct integer value", "error");
          btn.disabled = false;
          return;
        }
        correct_integer_value = parseFloat(val);
      }

      const wasEditing = !!editingQuestionId;
      const questionPayload = {
        test_id: currentTest.id,
        subject,
        question_type: type,
        question_text,
        image_url,
        explanation,
        options,
        correct_option,
        correct_integer_value,
        positive_marks,
        negative_marks,
      };
      if (!wasEditing) questionPayload.question_order = questionCounter++;

      // Make sure the current Supabase login session is available
      // before sending the INSERT/UPDATE request.
      const {
        data: { session },
      } = await sb.auth.getSession();

      if (!session?.user?.id) {
        btn.disabled = false;
        toast(
          "Your login session is not ready. Please refresh the page and try again.",
          "error",
        );
        return;
      }

      const { error } = wasEditing
        ? await sb
            .from("questions")
            .update(questionPayload)
            .eq("id", editingQuestionId)
        : await sb.from("questions").insert(questionPayload);

      btn.disabled = false;

      if (error) {
        console.error("Question save error:", error);
        toast(friendlyError(error), "error");
        return;
      }

      document.getElementById("questionTextInput").value = "";
      document.getElementById("imageFileInput").value = "";
      document.getElementById("explanationInput").value = "";
      document.getElementById("optA").value = "";
      document.getElementById("optB").value = "";
      document.getElementById("optC").value = "";
      document.getElementById("optD").value = "";
      document.getElementById("correctIntegerInput").value = "";
      document.getElementById("imagePreview").hidden = true;
      document.getElementById("imagePreview").innerHTML = "";
      editingQuestionId = null;
      editingQuestionImageUrl = null;
      btn.textContent = "Add question";
      updateQuestionPreview();
      document.getElementById("questionTextInput").focus();

      toast(wasEditing ? "Question updated" : "Question added", "success");
      await loadQuestions();
    });
}

async function enterAdminTestView() {
  myProfile = myProfile || (await getMyProfile());

  // reset all admin-test state/UI to a blank slate every time we arrive here
  currentTest = null;
  questionCounter = 0;
  editingQuestionId = null;
  editingQuestionImageUrl = null;
  document.getElementById("testDetailsForm").reset();
  document.getElementById("detailsTitle").textContent = "Test details";
  document.getElementById("saveDetailsBtn").textContent = "Create test";
  document.getElementById("shareCard").style.display = "none";
  document.getElementById("questionsCard").style.display = "none";
  document.getElementById("questionListCard").style.display = "none";
  document.getElementById("studentResultsCard").style.display = "none";
  document.getElementById("leaderboardCard").style.display = "none";
  document.getElementById("reportsCard").style.display = "none";
  document.getElementById("mcqFields").style.display = "block";
  document.getElementById("integerFields").style.display = "none";
  document.getElementById("typeInput").value = "mcq";

  if (!myProfile || myProfile.role !== "admin") {
    document.getElementById("notAdminNotice").style.display = "block";
    document.getElementById("adminMainContent").style.display = "none";
    return;
  }
  document.getElementById("notAdminNotice").style.display = "none";
  document.getElementById("adminMainContent").style.display = "block";

  const testId = qs("test");
  if (testId) {
    await loadExistingTest(testId);
  } else {
    const now = new Date();
    const later = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    document.getElementById("fromInput").value = toLocalInputValue(now);
    document.getElementById("untilInput").value = toLocalInputValue(later);
  }
}

async function loadExistingTest(testId) {
  const { data, error } = await sb
    .from("tests")
    .select("*")
    .eq("id", testId)
    .single();
  if (error || !data) {
    toast("Could not load that test", "error");
    return;
  }

  currentTest = data;
  document.getElementById("detailsTitle").textContent = "Test details";
  document.getElementById("saveDetailsBtn").textContent = "Save changes";
  document.getElementById("titleInput").value = data.title;
  document.getElementById("descInput").value = data.description || "";
  document.getElementById("categoryInput").value = data.category || "JEE Main";
  document.getElementById("durationInput").value = data.duration_minutes;
  document.getElementById("fromInput").value = toLocalInputValue(
    data.available_from,
  );
  document.getElementById("untilInput").value = toLocalInputValue(
    data.available_until,
  );

  showPostCreateSections();
  await loadQuestions();
  await loadStudentResults();
  await loadLeaderboard();
  await loadReports();
}

function showPostCreateSections() {
  document.getElementById("shareCard").style.display = "block";
  document.getElementById("questionsCard").style.display = "block";
  document.getElementById("questionListCard").style.display = "block";
  document.getElementById("studentResultsCard").style.display = "block";
  document.getElementById("leaderboardCard").style.display = "block";
  document.getElementById("reportsCard").style.display = "block";
  renderShareCard();

  document.getElementById("publishBtn").onclick = async () => {
    const newState = !currentTest.is_published;
    const { data, error } = await sb
      .from("tests")
      .update({ is_published: newState })
      .eq("id", currentTest.id)
      .select()
      .single();
    if (error) {
      toast(friendlyError(error), "error");
      return;
    }
    currentTest = data;
    renderShareCard();
    toast(
      newState ? "Test published — students can now join" : "Test unpublished",
      "success",
    );
  };
}

function renderShareCard() {
  const link = `${window.location.origin}${window.location.pathname}#/dashboard?code=${currentTest.test_code}`;
  document.getElementById("linkText").textContent = link;
  document.getElementById("codeText").textContent = currentTest.test_code;
  const tag = document.getElementById("publishTag");
  tag.textContent = currentTest.is_published ? "Published" : "Draft";
  tag.className =
    "status-tag " + (currentTest.is_published ? "published" : "draft");
  document.getElementById("publishBtn").textContent = currentTest.is_published
    ? "Unpublish"
    : "Publish";
  document.getElementById("copyLinkBtn").onclick = () => {
    navigator.clipboard.writeText(link).then(() => toast("Link copied"));
  };
}

async function loadQuestions() {
  const { data, error } = await sb
    .from("questions")
    .select("*")
    .eq("test_id", currentTest.id)
    .order("question_order");
  const list = document.getElementById("questionsList");
  const countTag = document.getElementById("questionCountTag");
  if (error) {
    list.innerHTML = `<div class="error-box">${escapeHtml(friendlyError(error))}</div>`;
    return;
  }

  questionCounter = data.length;
  countTag.textContent = `${data.length} question${data.length === 1 ? "" : "s"}`;

  if (data.length === 0) {
    list.innerHTML = `<div class="empty-state">No questions yet — add your first one above.</div>`;
    return;
  }

  list.innerHTML = data
    .map(
      (q, i) => `
    <div class="list-row">
      <div class="list-row-main">
        <div class="list-row-title">Q${i + 1}. ${escapeHtml(q.question_text.slice(0, 90))}${q.question_text.length > 90 ? "…" : ""}</div>
        <div class="list-row-meta">${subjectDot(q.subject)}${escapeHtml(q.subject)} · ${q.question_type === "mcq" ? "MCQ" : "Integer"} · +${q.positive_marks} / -${q.negative_marks}${q.explanation ? " · has explanation" : ""}</div>
      </div>
      <div class="list-row-actions">
        <button class="btn btn-sm js-edit-question" data-id="${q.id}">Edit</button>
        <button class="btn btn-sm btn-danger js-delete-question" data-id="${q.id}">Delete</button>
      </div>
    </div>
  `,
    )
    .join("");

  list.querySelectorAll(".js-delete-question").forEach((btn) => {
    btn.addEventListener("click", () => deleteQuestion(btn.dataset.id));
  });
  list.querySelectorAll(".js-edit-question").forEach((btn) => {
    btn.addEventListener("click", () =>
      editQuestion((data || []).find((q) => q.id === btn.dataset.id)),
    );
  });
}

function editQuestion(q) {
  if (!q) return;
  editingQuestionId = q.id;
  document.getElementById("subjectInput").value = q.subject || "";
  document.getElementById("typeInput").value = q.question_type;
  document.getElementById("typeInput").dispatchEvent(new Event("change"));
  document.getElementById("questionTextInput").value = q.question_text || "";
  editingQuestionImageUrl = q.image_url || null;
  const imagePreview = document.getElementById("imagePreview");
  imagePreview.hidden = !editingQuestionImageUrl;
  imagePreview.innerHTML = editingQuestionImageUrl
    ? `<img src="${escapeHtml(editingQuestionImageUrl)}" alt="Current question image">`
    : "";
  document.getElementById("explanationInput").value = q.explanation || "";
  document.getElementById("positiveMarksInput").value = q.positive_marks;
  document.getElementById("negativeMarksInput").value = q.negative_marks;
  if (q.question_type === "mcq") {
    (q.options || []).forEach((o) => {
      const field = document.getElementById("opt" + o.id);
      if (field) field.value = o.text || "";
    });
    document.getElementById("correctOptionInput").value =
      q.correct_option || "A";
  } else
    document.getElementById("correctIntegerInput").value =
      q.correct_integer_value ?? "";
  document.getElementById("addQuestionBtn").textContent =
    "Save question changes";
  updateQuestionPreview();
  document
    .getElementById("questionsCard")
    .scrollIntoView({ behavior: "smooth", block: "start" });
}

async function deleteQuestion(id) {
  if (!confirm("Delete this question? This can't be undone.")) return;
  const { error } = await sb.from("questions").delete().eq("id", id);
  if (error) {
    toast(friendlyError(error), "error");
    return;
  }
  toast("Question deleted");
  await loadQuestions();
}

function medalFor(rank) {
  return rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "";
}

function rankRowClass(rank) {
  return rank === 1
    ? "rank-gold"
    : rank === 2
      ? "rank-silver"
      : rank === 3
        ? "rank-bronze"
        : "";
}

async function loadStudentResults() {
  const statusEl = document.getElementById("resultDeclarationStatus");
  const actionsEl = document.getElementById("resultDeclarationActions");
  const body = document.getElementById("studentResultsBody");

  const declared = !!currentTest.result_release_at;
  statusEl.innerHTML = declared
    ? `<span class="status-tag published">Results Declared ✓</span>`
    : `<span class="status-tag draft">Results not declared yet</span>`;

  actionsEl.innerHTML = declared
    ? ""
    : `<button class="btn btn-primary btn-sm" id="declareResultsBtn">🏆 Declare Results</button>`;

  const declareBtn = document.getElementById("declareResultsBtn");
  if (declareBtn) {
    declareBtn.onclick = async () => {
      if (
        !confirm(
          "Are you sure you want to declare the results? Rank, percentile and leaderboard will become visible to students.",
        )
      )
        return;
      declareBtn.disabled = true;
      declareBtn.textContent = "Declaring…";
      const { error } = await sb.rpc("admin_declare_results", {
        p_test_id: currentTest.id,
      });
      if (error) {
        toast(friendlyError(error), "error");
        declareBtn.disabled = false;
        declareBtn.textContent = "🏆 Declare Results";
        return;
      }
      currentTest.result_release_at = new Date().toISOString();
      toast(
        "Results declared — students can now see their rank and the leaderboard",
        "success",
      );
      await loadStudentResults();
      await loadLeaderboard();
    };
  }

  const { data, error } = await sb.rpc("admin_get_test_results", {
    p_test_id: currentTest.id,
  });
  if (error) {
    body.innerHTML = `<tr><td colspan="7" class="text-muted">${escapeHtml(friendlyError(error))}</td></tr>`;
    return;
  }
  body.innerHTML = !data?.length
    ? `<tr><td colspan="7" class="text-muted">No attempts yet.</td></tr>`
    : data
        .map(
          (r) => `
    <tr>
      <td>${escapeHtml(r.full_name || "Student")}${
        r.disqualified_at
          ? ` <span class="status-tag" style="background:var(--danger-tint);color:var(--danger);">DQ</span>`
          : ""
      }</td>
      <td><span class="status-tag ${r.status}">${r.status.replace("_", " ")}</span></td>
      <td>${r.total_score}</td>
      <td>${r.correct_count}</td>
      <td>${r.wrong_count}</td>
<td>${r.unanswered_count ?? 0}</td>
      <td>${r.submitted_at ? formatDateTime(r.submitted_at) : "—"}</td>
    </tr>
  `,
        )
        .join("");
}

async function loadLeaderboard() {
  const { data, error } = await sb.rpc("get_test_leaderboard", {
    p_test_id: currentTest.id,
  });

  const body = document.getElementById("leaderboardBody");

  if (!body) return;

  if (error) {
    console.error("Leaderboard RPC error:", error);

    body.innerHTML = `
      <tr>
        <td colspan="5" class="text-muted">
          ${escapeHtml(friendlyError(error))}
        </td>
      </tr>
    `;

    return;
  }

  console.log("RAW LEADERBOARD DATA:", data);

  if (!data || data.length === 0) {
    body.innerHTML = `
      <tr>
        <td colspan="5" class="text-muted">
          No submissions yet.
        </td>
      </tr>
    `;

    return;
  }

  body.innerHTML = data
    .map((r) => {
      const rank = r.rnk ?? r.rank ?? r.ranking ?? "-";

      const student = r.full_name ?? r.student_name ?? r.name ?? "Student";

      const score = r.total_score ?? r.score ?? r.marks ?? 0;

      const percentile = r.percentile ?? r.percentile_score ?? 0;

      const attemptId = r.attempt_id ?? r.id ?? "";

      return `
        <tr>
          <td>${rank}</td>

          <td>
            ${escapeHtml(student)}
          </td>

          <td>
            ${score}
          </td>

          <td>
            ${Number(percentile).toFixed(3)}%
          </td>

          <td>
            <button
              type="button"
              class="btn btn-sm btn-warning js-remove-attempt"
              data-id="${attemptId}"
              ${attemptId ? "" : "disabled"}
            >
              Remove
            </button>
          </td>
        </tr>
      `;
    })
    .join("");

  body.querySelectorAll(".js-remove-attempt").forEach((btn) => {
    btn.addEventListener("click", function () {
      const attemptId = this.dataset.id;

      removeAttempt(attemptId, this);
    });
  });
}
async function removeAttempt(id, button) {
  if (!id) {
    toast(
      "Could not identify this attempt. Refresh the leaderboard and try again.",
      "error",
    );

    return;
  }

  const confirmed = confirm(
    "Remove this student from the leaderboard for suspected cheating? Their attempt will be disqualified.",
  );

  if (!confirmed) {
    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent = "Removing...";
  }

  try {
    const { data, error } = await sb.rpc("admin_disqualify_attempt", {
      p_attempt_id: id,
    });

    if (error) {
      console.error("admin_disqualify_attempt error:", error);

      if (button) {
        button.disabled = false;
        button.textContent = "Remove";
      }

      toast(friendlyError(error), "error");

      return;
    }

    console.log("Attempt successfully disqualified:", data);

    toast("Student removed from this leaderboard", "success");

    await loadLeaderboard();
  } catch (err) {
    console.error("Unexpected remove attempt error:", err);

    if (button) {
      button.disabled = false;
      button.textContent = "Remove";
    }

    toast("Something went wrong while removing the student.", "error");
  }
}

async function loadReports() {
  const list = document.getElementById("reportsList");
  if (!currentTest) return;
  const { data, error } = await sb
    .from("question_reports")
    .select(
      "id, reason, details, created_at, questions(question_text), profiles(full_name)",
    )
    .eq("test_id", currentTest.id)
    .order("created_at", { ascending: false });
  if (error) {
    list.innerHTML = `<div class="error-box">${escapeHtml(friendlyError(error))}</div>`;
    return;
  }
  list.innerHTML = !data?.length
    ? `<div class="empty-state">No question reports yet.</div>`
    : data
        .map(
          (r) => `
    <div class="list-row"><div class="list-row-main"><div class="list-row-title">${escapeHtml(r.reason)}</div>
    <div class="list-row-meta">${escapeHtml(r.profiles?.full_name || "Student")} · ${formatDateTime(r.created_at)}${r.details ? " · " + escapeHtml(r.details) : ""}</div>
    <div class="question-text" style="font-size:13px;">${escapeHtml(r.questions?.question_text || "Question unavailable")}</div></div></div>`,
        )
        .join("");
  renderMath(list);
}

/* =========================================================================
   6. EXAM VIEW
   ========================================================================= */
let attemptId,
  testId,
  testTitle,
  testCategory,
  durationMinutes,
  startedAt,
  totalMarks,
  warningCount;
let candidateName = "";
// The test code being entered, resolved once in enterExamView and used by
// onBegin — the actual attempt (and its clock) is only created once the
// student clicks Begin Test, not the moment this page loads.
let pendingTestCode = null;
let questions = [];
let bySubject = {};
let subjects = [];
let currentSubject = null;
let currentLocalIndex = 0;
let timerInterval = null;
let answerSaveQueue = Promise.resolve();
let examStarted = false;
let submitted = false;
let violationModalOpen = false;
let intentionalFullscreenExit = false;
let activeTimingQuestion = null;
let activeTimingStart = null;

/* -------------------------------------------------------------------------
   Time-spent tracking: batched instead of one API call per question.

   Every navigation away from a question used to fire its own
   `add_time_spent` RPC immediately. On a 90-question test that's ~90+
   network calls from navigation alone. Instead, elapsed time is now kept
   locally in `pendingTimeDeltas` (question_id -> accumulated seconds,
   merging repeat visits from "mark for review" automatically) and only
   sent on a periodic timer, plus a handful of safety points — never on
   plain navigation.
   ------------------------------------------------------------------------- */
let pendingTimeDeltas = new Map();
let timeSyncInterval = null;
// Optimistic: if a batched `add_time_spent_batch` RPC exists in this
// Supabase project (see the optional SQL in the accompanying notes), it's
// used automatically — a single request per flush covering every pending
// question, regardless of how many. If it isn't deployed, this flips to
// false on the first failed attempt and every flush falls back to one
// `add_time_spent` call per distinct pending question (still merged
// across revisits, still far fewer calls than before) for the rest of
// this attempt — no broken behaviour either way.
let timeSpentBatchAvailable = true;

// Record elapsed time on the question being navigated away from — purely
// local, no network call here anymore.
function commitActiveTime() {
  if (!activeTimingQuestion || !activeTimingStart) return;
  const q = activeTimingQuestion;
  const elapsed = (Date.now() - activeTimingStart) / 1000;
  activeTimingStart = null;
  if (elapsed < 0.3) return;
  q.time_spent = (q.time_spent || 0) + elapsed;
  pendingTimeDeltas.set(q.id, (pendingTimeDeltas.get(q.id) || 0) + elapsed);
}
function startTimingQuestion(q) {
  activeTimingQuestion = q;
  activeTimingStart = q ? Date.now() : null;
}

// Sends whatever time has accumulated locally. Called periodically (every
// 45s) while a test is running, as a best-effort safety net when the tab
// is hidden or the page is being unloaded, and — awaited — right before
// submission so no meaningful time data is ever lost.
async function flushTimeDeltas({ awaitCompletion = false } = {}) {
  if (!attemptId || pendingTimeDeltas.size === 0) return;
  const entries = Array.from(pendingTimeDeltas.entries()).filter(
    ([, seconds]) => seconds > 0,
  );
  pendingTimeDeltas.clear();
  if (entries.length === 0) return;

  const requeue = () => {
    entries.forEach(([qid, secs]) => {
      pendingTimeDeltas.set(qid, (pendingTimeDeltas.get(qid) || 0) + secs);
    });
  };

  const send = async () => {
    if (timeSpentBatchAvailable) {
      const { error } = await sb.rpc("add_time_spent_batch", {
        p_attempt_id: attemptId,
        p_deltas: entries.map(([question_id, seconds]) => ({
          question_id,
          seconds,
        })),
      });
      if (!error) return;
      const notDeployed =
        error.code === "PGRST202" ||
        /schema cache|does not exist|not found/i.test(error.message || "");
      if (notDeployed) {
        // No batch function in this project — fall back permanently for
        // the rest of this attempt instead of re-failing every 45s.
        timeSpentBatchAvailable = false;
      } else {
        console.error(error);
        requeue();
        return;
      }
    }
    const results = await Promise.allSettled(
      entries.map(([question_id, seconds]) =>
        sb
          .rpc("add_time_spent", {
            p_attempt_id: attemptId,
            p_question_id: question_id,
            p_seconds: seconds,
          })
          .then(({ error }) => {
            if (error) throw error;
          }),
      ),
    );
    // Only requeue the ones that actually failed, so a single flaky
    // request doesn't cost you every other question's progress too.
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        const [qid, secs] = entries[i];
        pendingTimeDeltas.set(qid, (pendingTimeDeltas.get(qid) || 0) + secs);
      }
    });
  };

  if (awaitCompletion) {
    await send();
  } else {
    send().catch((e) => console.error(e));
  }
}

function setupExamStaticListeners() {
  document.getElementById("beginBtn").addEventListener("click", onBegin);
  document
    .getElementById("submitTestBtn")
    .addEventListener("click", openSubmitModal);
  document
    .getElementById("cancelSubmitBtn")
    .addEventListener("click", () => closeModal("submitModal"));
  document
    .getElementById("confirmSubmitBtn")
    .addEventListener("click", () => doSubmit("manual"));
  document
    .getElementById("violationOkBtn")
    .addEventListener("click", onViolationAck);
  document
    .getElementById("paletteToggleBtn")
    .addEventListener("click", togglePaletteDrawer);

  document
    .getElementById("paletteBackdrop")
    .addEventListener("click", togglePaletteDrawer);

  document
    .getElementById("paletteCloseBtn")
    .addEventListener("click", togglePaletteDrawer);
}

function closeModal(id) {
  document.getElementById(id).classList.remove("open");
}
function openModal(id) {
  document.getElementById(id).classList.add("open");
}

function showTerminal(title, text, href, label) {
  // Terminal states are also used before the exam shell has finished loading.
  // Reveal it here so an error/previous-attempt message never becomes a blank screen.
  document.getElementById("loadingScreen").style.display = "none";
  document.getElementById("examShell").style.display = "block";
  document.getElementById("terminalTitle").textContent = title;
  document.getElementById("terminalText").textContent = text;
  const btn = document.getElementById("terminalActionBtn");
  btn.href = href;
  btn.textContent = label;
  openModal("terminalModal");
}

// Builds the formal, CBT-style instructions shown before a test starts —
// general rules, navigation, the palette legend, marking scheme, and the
// full-screen / fair-use policy — ending in a declaration checkbox that
// must be ticked before Begin Test can be clicked.
function renderBeginInstructions() {
  const beginText =
    warningCount > 0
      ? "You already have a warning on this attempt from a previous session. One more violation will submit your test automatically."
      : "Please read every section below carefully before you begin.";

  document.getElementById("beginInstructions").innerHTML = `
    <div class="instruction-text"><strong>${escapeHtml(testTitle)}</strong> &nbsp;·&nbsp; ${escapeHtml(testCategory)} &nbsp;·&nbsp; Duration: ${durationMinutes} minutes</div>

    <div class="instruction-section">
      <strong>1. General Instructions</strong>
      <ul>
        <li>The countdown timer in the top bar shows the time remaining to complete the test. When it reaches zero, the test is submitted automatically.</li>
        <li>The timer starts only once you click <strong>Begin Test</strong> below — it does not run while you are reading these instructions.</li>
        <li>The test must be attempted in one continuous sitting. Do not close or refresh this page once you begin.</li>
      </ul>
    </div>

    <div class="instruction-section">
      <strong>2. Navigating a Question</strong>
      <ul>
        <li>Select an option (MCQ) or enter a value (numerical), then click <strong>Save &amp; next</strong> to save your response and move on.</li>
        <li><strong>Mark for review &amp; next</strong> flags a question to revisit, without discarding any answer already saved.</li>
        <li><strong>Clear response</strong> removes your saved answer for the current question.</li>
        <li>Use the question palette on the side to jump to any question, in any order, at any time before submitting.</li>
      </ul>
    </div>

    <div class="instruction-section">
      <strong>3. Question Palette — Legend</strong>
      <div class="palette-legend">
        <div class="legend-item"><span class="legend-swatch" style="background:var(--not-visited-tint);border:1px solid var(--border-strong);"></span>Not visited</div>
        <div class="legend-item"><span class="legend-swatch" style="background:var(--danger);"></span>Not answered</div>
        <div class="legend-item"><span class="legend-swatch" style="background:var(--success);"></span>Answered</div>
        <div class="legend-item"><span class="legend-swatch" style="background:var(--review);"></span>Marked for review</div>
      </div>
    </div>

    <div class="instruction-section">
      <strong>4. Marking Scheme</strong>
      <ul>
        <li>Each question carries its own positive and negative marks, shown alongside it — marks are awarded only for the correct option or value.</li>
        <li>Unattempted questions receive zero marks and no negative marking.</li>
      </ul>
    </div>

    <div class="instruction-warning">
      <strong>5. Full-Screen &amp; Fair-Use Policy</strong>
      <p>This test runs in full-screen mode. Exiting full-screen, switching tabs or apps, or minimising the browser after you begin is recorded as a violation. A second violation submits your test automatically. If you're warned, use <strong>Return to test</strong> to re-enter full-screen and continue.</p>
      <p>${escapeHtml(beginText)}</p>
    </div>

    <label class="declaration-row">
      <input type="checkbox" id="declarationCheckbox">
      <span>I have read and understood the instructions above, and I agree to abide by them.</span>
    </label>
  `;

  const beginBtn = document.getElementById("beginBtn");
  const declarationCheckbox = document.getElementById("declarationCheckbox");
  beginBtn.disabled = true;
  beginBtn.textContent = previousAttemptInProgress
    ? "Resume Test"
    : "Begin Test";
  declarationCheckbox.addEventListener("change", () => {
    beginBtn.disabled = !declarationCheckbox.checked;
  });
}

let previousAttemptInProgress = false;

async function enterExamView() {
  // Reset everything to a clean slate — this view can be entered more than
  // once per page session (e.g. one test after another).
  clearInterval(timerInterval);
  clearInterval(timeSyncInterval);
  pendingTimeDeltas.clear();
  removeAntiCheatListeners();
  ["beginModal", "violationModal", "submitModal", "terminalModal"].forEach(
    closeModal,
  );
  examLocked = false;
  examStarted = false;
  submitted = false;
  violationModalOpen = false;
  intentionalFullscreenExit = false;
  activeTimingQuestion = null;
  activeTimingStart = null;
  questions = [];
  bySubject = {};
  subjects = [];
  currentSubject = null;
  currentLocalIndex = 0;

  document.getElementById("examShell").style.display = "none";
  document.getElementById("loadingScreen").style.display = "flex";

  const {
    data: { session },
  } = await sb.auth.getSession();
  const profile = myProfile || (await getMyProfile());
  candidateName = profile?.full_name || session.user.email;

  const code = qs("code");
  if (!code) {
    showTerminal(
      "No test code",
      "No test code was given in the link. Go back to your dashboard and enter a code.",
      "#/dashboard",
      "Back to dashboard",
    );
    document.getElementById("loadingScreen").style.display = "none";
    return;
  }
  pendingTestCode = code.toUpperCase();

  // Look up the test and any existing attempt WITHOUT starting the exam —
  // start_attempt (which stamps the server-side started_at the countdown
  // is based on) only runs once the student clicks Begin Test, so reading
  // the instructions never eats into the exam clock.
  const [{ data: testMeta, error: testMetaError }, { data: previousAttempt }] =
    await Promise.all([
      sb
        .from("tests")
        .select("title, category, duration_minutes, is_published")
        .eq("test_code", pendingTestCode)
        .maybeSingle(),
      sb
        .from("test_attempts")
        .select(
          "id, status, disqualified_at, warning_count, tests!inner(test_code)",
        )
        .eq("user_id", session.user.id)
        .eq("tests.test_code", pendingTestCode)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (testMetaError || !testMeta || !testMeta.is_published) {
    showTerminal(
      "Test not found",
      "No published test was found for this code. Go back to your dashboard and check the link.",
      "#/dashboard",
      "Back to dashboard",
    );
    document.getElementById("loadingScreen").style.display = "none";
    return;
  }

  if (previousAttempt?.disqualified_at) {
    showTerminal(
      "Test access removed",
      "An administrator has removed you from this test. Contact your admin if you believe this is a mistake.",
      "#/dashboard",
      "Back to dashboard",
    );
    return;
  }
  if (["submitted", "auto_submitted"].includes(previousAttempt?.status)) {
    showTerminal(
      "Test already attempted",
      "You have already submitted this test. You cannot start it again, but you can view your report.",
      `#/result?attempt=${previousAttempt.id}`,
      "View your report",
    );
    return;
  }

  testTitle = testMeta.title;
  testCategory = testMeta.category;
  durationMinutes = testMeta.duration_minutes;
  warningCount = previousAttempt?.warning_count || 0;
  previousAttemptInProgress = previousAttempt?.status === "in_progress";

  document.getElementById("examTitle").innerHTML =
    `${escapeHtml(testTitle)} ${categoryBadge(testCategory)}`;
  document.getElementById("examCandidate").textContent = candidateName;

  document.getElementById("loadingScreen").style.display = "none";
  document.getElementById("examShell").style.display = "block";

  renderBeginInstructions();
  openModal("beginModal");

  // Timer does NOT start here, and questions are not loaded yet either —
  // both happen only once Begin Test is clicked, in onBegin().
}

async function loadQuestionsAndAnswers() {
  const [{ data: qData, error: qErr }, { data: aData }] = await Promise.all([
    sb.rpc("get_test_questions", { p_attempt_id: attemptId }),
    sb.from("attempt_answers").select("*").eq("attempt_id", attemptId),
  ]);

  if (qErr) {
    showTerminal(
      "Couldn't load questions",
      friendlyError(qErr),
      "#/dashboard",
      "Back to dashboard",
    );
    return;
  }

  const answerMap = {};
  (aData || []).forEach((a) => {
    answerMap[a.question_id] = a;
  });

  questions = (qData || []).map((q) => {
    const existing = answerMap[q.id];
    return {
      ...q,
      status: existing ? existing.status : "not_visited",
      selected_option: existing ? existing.selected_option : null,
      integer_answer: existing ? existing.integer_answer : null,
      time_spent: existing ? Number(existing.time_spent_seconds) || 0 : 0,
    };
  });
}

function buildSubjectStructure() {
  bySubject = {};
  subjects = [];
  questions.forEach((q) => {
    if (!bySubject[q.subject]) {
      bySubject[q.subject] = [];
      subjects.push(q.subject);
    }
    bySubject[q.subject].push(q);
  });
  currentSubject = subjects[0] || null;
  currentLocalIndex = 0;
}

function startTimer() {
  const endTime = new Date(startedAt).getTime() + durationMinutes * 60000;
  const timerEl = document.getElementById("examTimer");

  function tick() {
    const remainingMs = endTime - Date.now();
    const remainingSec = Math.floor(remainingMs / 1000);
    timerEl.textContent = formatCountdown(remainingSec);
    timerEl.classList.toggle("low", remainingSec <= 300);
    if (remainingMs <= 0) {
      clearInterval(timerInterval);
      if (!submitted) doSubmit("time");
    }
  }
  tick();
  timerInterval = setInterval(tick, 1000);
}

function renderSubjectTabs() {
  const wrap = document.getElementById("subjectTabs");
  wrap.innerHTML = subjects
    .map(
      (s) =>
        `<button type="button" data-subject="${escapeHtml(s)}" class="${s === currentSubject ? "active" : ""}">${subjectDot(s)}${escapeHtml(s)}</button>`,
    )
    .join("");
  wrap.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.subject === currentSubject) return;
      commitActiveTime();
      currentSubject = btn.dataset.subject;
      currentLocalIndex = 0;
      renderSubjectTabs();
      renderPalette();
      startTimingQuestion(currentQuestion());
      renderQuestion();
    });
  });
}

function renderPalette() {
  const grid = document.getElementById("paletteGrid");
  const list = bySubject[currentSubject] || [];
  grid.innerHTML = list
    .map(
      (q, i) =>
        `<button type="button" class="palette-btn ${q.status} ${i === currentLocalIndex ? "current" : ""}" data-i="${i}">${i + 1}</button>`,
    )
    .join("");
  grid.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const newIndex = parseInt(btn.dataset.i, 10);
      if (newIndex !== currentLocalIndex) {
        commitActiveTime();
        currentLocalIndex = newIndex;
        startTimingQuestion(currentQuestion());
      }
      renderPalette();
      renderQuestion();
      document.getElementById("palettePanel").classList.remove("open");
      document.getElementById("paletteBackdrop").classList.remove("open");
    });
  });
}

function togglePaletteDrawer() {
  document.getElementById("palettePanel").classList.toggle("open");
  document.getElementById("paletteBackdrop").classList.toggle("open");
}

function currentQuestion() {
  return (bySubject[currentSubject] || [])[currentLocalIndex];
}

function renderQuestion() {
  const q = currentQuestion();
  const card = document.getElementById("questionCard");
  if (!q) {
    card.innerHTML = `<div class="empty-state">No questions in this subject.</div>`;
    return;
  }

  if (q.status === "not_visited") q.status = "not_answered";
  card.style.borderLeft = `4px solid ${subjectColor(q.subject)}`;

  let bodyHtml = "";
  if (q.question_type === "mcq") {
    bodyHtml =
      `<div class="option-list">` +
      q.options
        .map(
          (o) => `
      <div class="option-item ${q.selected_option === o.id ? "selected" : ""}" data-opt="${o.id}">
        <span class="option-letter">${o.id}</span>
        <span class="option-text">${escapeHtml(o.text)}</span>
      </div>
    `,
        )
        .join("") +
      `</div>`;
  } else {
    bodyHtml = `
      <div class="integer-input-wrap">
        <input type="number" step="any" id="integerAnswerInput" value="${q.integer_answer ?? ""}" placeholder="Enter value">
      </div>
    `;
  }

  card.innerHTML = `
    <div class="question-meta">
      <span class="question-number-badge">${subjectDot(q.subject)}${escapeHtml(q.subject)} · Question ${currentLocalIndex + 1}</span>
      <span class="question-marks">+${q.positive_marks} / -${q.negative_marks}</span>
    </div>
    ${questionImageHtml(q.image_url)}
    <div class="question-text">${escapeHtml(q.question_text)}</div>
    <div class="question-tools"><button type="button" class="report-question-icon" id="reportQuestionBtn" aria-label="Report this question" title="Report this question">⚠</button></div>
    ${bodyHtml}
    <div class="exam-actions">
      <div class="exam-actions-left">
        <button class="btn" id="markReviewBtn">Mark for review &amp; next</button>
      </div>
      <div class="exam-actions-right">
        <button class="btn" id="clearResponseBtn">Clear response</button>
        <button class="btn btn-success" id="saveNextBtn">Save &amp; next</button>
      </div>
    </div>
  `;

  if (q.question_type === "mcq") {
    card.querySelectorAll(".option-item").forEach((el) => {
      el.addEventListener("click", () => {
        q.selected_option = el.dataset.opt;
        q.status =
          q.status === "marked" || q.status === "answered_marked"
            ? "answered_marked"
            : "answered";
        card
          .querySelectorAll(".option-item")
          .forEach((o) => o.classList.remove("selected"));
        el.classList.add("selected");
        persistAnswer(q);
        renderPalette();
      });
    });
  } else {
    document
      .getElementById("integerAnswerInput")
      .addEventListener("input", (e) => {
        q.integer_answer =
          e.target.value === "" ? null : parseFloat(e.target.value);
      });
  }

  document
    .getElementById("saveNextBtn")
    .addEventListener("click", () => goSaveNext(q));
  document
    .getElementById("markReviewBtn")
    .addEventListener("click", () => goMarkReview(q));
  document
    .getElementById("clearResponseBtn")
    .addEventListener("click", () => goClear(q));
  document
    .getElementById("reportQuestionBtn")
    .addEventListener("click", () => reportQuestion(q));

  renderMath(card);
  renderPalette();
}

let reportingQuestion = null;
function reportQuestion(q) {
  reportingQuestion = q;
  document.getElementById("reportReason").value = "image not visible";
  document.getElementById("reportDetails").value = "";
  openModal("reportQuestionModal");
}

function hasAnswer(q) {
  return q.question_type === "mcq"
    ? !!q.selected_option
    : q.integer_answer !== null &&
        q.integer_answer !== undefined &&
        q.integer_answer !== "";
}

function persistAnswer(q) {
  // Snapshot the current state and serialize writes. Fast option taps followed
  // by Mark for review can otherwise reach Supabase in the wrong order.
  const payload = {
    p_attempt_id: attemptId,
    p_question_id: q.id,
    p_selected_option: q.question_type === "mcq" ? q.selected_option : null,
    p_integer_answer: q.question_type === "integer" ? q.integer_answer : null,
    p_status: q.status,
  };
  answerSaveQueue = answerSaveQueue
    .catch(() => {})
    .then(async () => {
      const { error } = await sb.rpc("save_answer", payload);
      if (error) throw error;
    });
  return answerSaveQueue
    .then(() => true)
    .catch((error) => {
      toast(friendlyError(error), "error");
      return false;
    });
}

function moveToNext() {
  commitActiveTime();
  const list = bySubject[currentSubject];
  if (currentLocalIndex < list.length - 1) {
    currentLocalIndex++;
  } else {
    const subjIdx = subjects.indexOf(currentSubject);
    if (subjIdx < subjects.length - 1) {
      currentSubject = subjects[subjIdx + 1];
      currentLocalIndex = 0;
      renderSubjectTabs();
    }
  }
  startTimingQuestion(currentQuestion());
  renderQuestion();
}

async function goSaveNext(q) {
  q.status = hasAnswer(q) ? "answered" : "not_answered";
  if (!(await persistAnswer(q))) return;
  moveToNext();
}

async function goMarkReview(q) {
  q.status = hasAnswer(q) ? "answered_marked" : "marked";
  if (!(await persistAnswer(q))) return;
  moveToNext();
}

async function goClear(q) {
  q.selected_option = null;
  q.integer_answer = null;
  q.status = "not_answered";
  if (!(await persistAnswer(q))) return;
  renderQuestion();
}

function openSubmitModal() {
  const counts = {
    not_visited: 0,
    not_answered: 0,
    answered: 0,
    marked: 0,
    answered_marked: 0,
  };
  questions.forEach((q) => {
    counts[q.status] = (counts[q.status] || 0) + 1;
  });
  const grid = document.getElementById("submitSummaryGrid");
  grid.innerHTML = `
    <div class="modal-summary-item"><div class="num">${counts.answered + counts.answered_marked}</div><div class="lbl">Answered</div></div>
    <div class="modal-summary-item"><div class="num">${counts.not_answered}</div><div class="lbl">Not answered</div></div>
    <div class="modal-summary-item"><div class="num">${counts.marked + counts.answered_marked}</div><div class="lbl">Marked for review</div></div>
    <div class="modal-summary-item"><div class="num">${counts.not_visited}</div><div class="lbl">Not visited</div></div>
  `;
  openModal("submitModal");
}

async function doSubmit(reason) {
  if (submitted) return;
  // Save the answer visible on screen before scoring. This makes a direct
  // Submit after selecting an option count without needing Save & next.
  const activeQuestion = currentQuestion();
  if (activeQuestion) {
    if (
      hasAnswer(activeQuestion) &&
      activeQuestion.status !== "marked" &&
      activeQuestion.status !== "answered_marked"
    )
      activeQuestion.status = "answered";
    if (!(await persistAnswer(activeQuestion))) return;
  }
  commitActiveTime();
  submitted = true;
  examLocked = false;
  clearInterval(timerInterval);
  clearInterval(timeSyncInterval);
  closeModal("submitModal");
  removeAntiCheatListeners();

  // Final time sync — awaited, so no time data from the last stretch of
  // the test (since the previous ~45s tick) is lost before scoring.
  await flushTimeDeltas({ awaitCompletion: true });

  const { data, error } = await sb.rpc("submit_attempt", {
    p_attempt_id: attemptId,
    p_auto: reason !== "manual",
  });

  intentionalFullscreenExit = true;
  if (document.fullscreenElement) {
    try {
      await document.exitFullscreen();
    } catch (e) {}
  }

  if (error) {
    showTerminal(
      "Couldn't submit",
      friendlyError(error),
      "#/dashboard",
      "Back to dashboard",
    );
    return;
  }

  const reasonText =
    {
      manual: "Your test has been submitted successfully.",
      time: "Time's up — your test was submitted automatically.",
      violation:
        "Your test was submitted automatically after repeated warnings about leaving the exam window.",
    }[reason] || "Your test has been submitted.";

  showFeedbackThenResult(data, reasonText);
}

async function onBegin() {
  const beginBtn = document.getElementById("beginBtn");
  const originalBtnText = beginBtn.textContent;
  beginBtn.disabled = true;
  beginBtn.textContent = "Starting…";

  // Enter full-screen mode FIRST, synchronously with the click — this has
  // to happen before any await to a server, or the browser no longer
  // considers it part of the user gesture and silently refuses it.
  try {
    if (
      !document.fullscreenElement &&
      document.documentElement.requestFullscreen
    ) {
      try {
        await document.documentElement.requestFullscreen({
          navigationUI: "hide",
        });
      } catch (_) {
        await document.documentElement.requestFullscreen();
      }
    }
  } catch (_) {
    toast(
      "Full-screen mode was not allowed by this browser. Continue in the largest available window.",
      "error",
    );
  }

  // This is the moment the exam clock actually starts — start_attempt
  // stamps started_at server-side right now, not back when the page loaded.
  const { data, error } = await sb.rpc("start_attempt", {
    p_test_code: pendingTestCode,
  });

  if (error) {
    closeModal("beginModal");
    showTerminal(
      "Can't start this test",
      friendlyError(error),
      "#/dashboard",
      "Back to dashboard",
    );
    return;
  }
  if (!data?.attempt_id) {
    closeModal("beginModal");
    showTerminal(
      "Can't start this test",
      "This test has already been attempted or is no longer available.",
      "#/dashboard",
      "Back to dashboard",
    );
    return;
  }
  if (data.expired) {
    closeModal("beginModal");
    showTerminal(
      "Time's up",
      "Your time for this test had already run out, so it was submitted automatically.",
      `#/result?attempt=${data.attempt_id}`,
      "View your report",
    );
    return;
  }

  attemptId = data.attempt_id;
  testId = data.test_id;
  testTitle = data.title;
  testCategory = data.category;
  durationMinutes = data.duration_minutes;
  startedAt = data.started_at;
  totalMarks = data.total_marks;
  warningCount = data.warning_count || 0;

  const { data: moderation } = await sb
    .from("test_attempts")
    .select("disqualified_at")
    .eq("id", attemptId)
    .maybeSingle();
  if (moderation?.disqualified_at) {
    closeModal("beginModal");
    showTerminal(
      "Test access removed",
      "An administrator has removed you from this test. Contact your admin if you believe this is a mistake.",
      "#/dashboard",
      "Back to dashboard",
    );
    return;
  }

  await loadQuestionsAndAnswers();
  buildSubjectStructure();

  document.getElementById("examCandidate").textContent =
    `${candidateName} · Max marks: ${totalMarks}`;

  beginBtn.disabled = false;
  beginBtn.textContent = originalBtnText;
  closeModal("beginModal");

  examStarted = true;
  examLocked = true;

  // Start timer ONLY after clicking Begin Test
  startTimer();

  // Batched time-sync: accumulates locally, sent roughly every 45s instead
  // of on every question navigation (see flushTimeDeltas above).
  clearInterval(timeSyncInterval);
  timeSyncInterval = setInterval(() => flushTimeDeltas(), 45000);

  addAntiCheatListeners();
  renderSubjectTabs();
  renderPalette();
  renderQuestion();
  startTimingQuestion(currentQuestion());
}

function onVisibilityChange() {
  if (document.hidden && examStarted && !submitted) {
    // Safety net: send whatever time has accumulated so far rather than
    // waiting for the next ~45s tick, in case the tab never comes back.
    flushTimeDeltas();
    triggerViolation();
  }
}
function onFullscreenChange() {
  if (!document.fullscreenElement && examStarted && !submitted) {
    if (intentionalFullscreenExit) {
      intentionalFullscreenExit = false;
      return;
    }
    triggerViolation();
  }
}
function onContextMenu(e) {
  if (examStarted) e.preventDefault();
}
function onCopyCut(e) {
  if (examStarted) e.preventDefault();
}
function onKeyDown(e) {
  if (!examStarted) return;
  const blocked =
    e.key === "F12" ||
    (e.ctrlKey &&
      e.shiftKey &&
      ["I", "J", "C"].includes(e.key.toUpperCase())) ||
    (e.ctrlKey && e.key.toUpperCase() === "U");
  if (blocked) e.preventDefault();
}
function onBeforeUnload(e) {
  if (examStarted && !submitted) {
    flushTimeDeltas();
    e.preventDefault();
    e.returnValue = "";
  }
}
// Fires reliably on mobile when the app is backgrounded or the tab is
// closed, even in cases beforeunload doesn't — another best-effort point
// to get accumulated time off the device before it's potentially lost.
function onPageHide() {
  if (examStarted && !submitted) flushTimeDeltas();
}

function addAntiCheatListeners() {
  document.addEventListener("visibilitychange", onVisibilityChange);
  document.addEventListener("fullscreenchange", onFullscreenChange);
  document.addEventListener("contextmenu", onContextMenu);
  document.addEventListener("copy", onCopyCut);
  document.addEventListener("cut", onCopyCut);
  document.addEventListener("keydown", onKeyDown);
  window.addEventListener("beforeunload", onBeforeUnload);
  window.addEventListener("pagehide", onPageHide);
}
function removeAntiCheatListeners() {
  document.removeEventListener("visibilitychange", onVisibilityChange);
  document.removeEventListener("fullscreenchange", onFullscreenChange);
  document.removeEventListener("contextmenu", onContextMenu);
  document.removeEventListener("copy", onCopyCut);
  document.removeEventListener("cut", onCopyCut);
  document.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("beforeunload", onBeforeUnload);
  window.removeEventListener("pagehide", onPageHide);
}

async function triggerViolation() {
  if (violationModalOpen || submitted) return;
  violationModalOpen = true;

  const { data, error } = await sb.rpc("register_violation", {
    p_attempt_id: attemptId,
  });
  if (error) {
    violationModalOpen = false;
    return;
  }

  if (data.status === "auto_submitted") {
    commitActiveTime();
    submitted = true;
    examLocked = false;
    clearInterval(timerInterval);
    clearInterval(timeSyncInterval);
    removeAntiCheatListeners();
    // Final time sync here too — this path bypasses doSubmit() entirely
    // since the server already auto-submitted as part of register_violation.
    await flushTimeDeltas({ awaitCompletion: true });
    intentionalFullscreenExit = true;
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch (e) {}
    }
    showTerminal(
      "Test auto-submitted",
      "Your test was submitted automatically after repeated warnings about leaving the exam window.",
      `#/result?attempt=${attemptId}`,
      "View your report",
    );
    return;
  }

  document.getElementById("violationText").textContent =
    `This is warning ${data.warning_count} of 2. Leaving the test window, exiting full-screen, or switching tabs again will automatically submit your test.`;
  openModal("violationModal");
}

async function onViolationAck() {
  closeModal("violationModal");
  violationModalOpen = false;

  // Re-enter full-screen before   continuing
  try {
    if (
      !document.fullscreenElement &&
      document.documentElement.requestFullscreen
    ) {
      try {
        await document.documentElement.requestFullscreen({
          navigationUI: "hide",
        });
      } catch (_) {
        await document.documentElement.requestFullscreen();
      }
    }
  } catch (_) {
    toast("Please enter full-screen mode to continue the test.", "error");
  }
}
/* =========================================================================
   7. RESULT VIEW
   ========================================================================= */
function renderReviewQuestion(r) {
  let bodyHtml = "";
  if (r.question_type === "mcq") {
    bodyHtml =
      `<div class="option-list">` +
      (r.options || [])
        .map((o) => {
          const isCorrect = o.id === r.correct_option;
          const isPicked = o.id === r.selected_option;
          const cls = isCorrect
            ? "review-correct"
            : isPicked
              ? "review-wrong"
              : "";
          const tag = isCorrect
            ? `<span class="status-tag published" style="margin-left:auto;">Correct answer</span>`
            : isPicked
              ? `<span class="status-tag" style="margin-left:auto;background:var(--danger-tint);color:var(--danger);">Your answer</span>`
              : "";
          return `
        <div class="option-item ${cls}">
          <span class="option-letter">${o.id}</span>
          <span class="option-text">${escapeHtml(o.text)}</span>
          ${tag}
        </div>
      `;
        })
        .join("") +
      `</div>`;
  } else {
    bodyHtml = `
      <p style="font-size:14px;">
        <span style="color:var(--danger);font-weight:650;">Your answer: ${r.integer_answer ?? "—"}</span>
        &nbsp;·&nbsp;
        <span style="color:var(--success);font-weight:650;">Correct answer: ${r.correct_integer_value}</span>
      </p>
    `;
  }
  return `
    <div class="card" style="box-shadow:none;">
      <div class="list-row-meta" style="margin-bottom:6px;">${subjectDot(r.subject)}${escapeHtml(r.subject)} · ${r.marks_obtained} marks</div>
      ${questionImageHtml(r.image_url)}
      <div class="question-text" style="font-size:14.5px;margin-bottom:12px;">${escapeHtml(r.question_text)}</div>
      ${bodyHtml}
      ${r.explanation ? `<div class="explanation-box mt-8">${escapeHtml(r.explanation)}</div>` : ""}
    </div>
  `;
}

async function enterResultView() {
  const content = document.getElementById("resultContent");
  content.innerHTML = `<div class="empty-state">Loading your report…</div>`;

  const attemptIdParam = qs("attempt");
  if (!attemptIdParam) {
    content.innerHTML = `<div class="error-box">No test attempt was specified.</div>`;
    return;
  }

  const { data: report, error } = await sb.rpc("get_full_report", {
    p_attempt_id: attemptIdParam,
  });

  if (error || !report) {
    content.innerHTML = `<div class="error-box">Couldn't load this report. ${escapeHtml(friendlyError(error))}</div>`;
    return;
  }

  if (report.status === "in_progress") {
    content.innerHTML = `
      <div class="card">
        <h2 style="font-size:16px;">Still in progress</h2>
        <p class="text-muted">This test hasn't been submitted yet.</p>
        <a class="btn btn-primary" href="#/exam?code=${report.test_code}">Resume test</a>
      </div>
    `;
    return;
  }

  // Score is always available immediately after submission. Rank,
  // percentile and the leaderboard stay locked until the admin declares
  // results — get_full_report simply returns null/empty for those until
  // then, rather than erroring, so `declared` is derived from that.
  const declared = report.rank !== null && report.rank !== undefined;
  const subjectRows = report.subject_rows || [];
  const review = report.review || [];
  const board = report.board || [];
  const incorrectAnswers = review.filter((r) => r.is_correct === false);
  const totalMax = subjectRows.reduce((s, r) => s + Number(r.total), 0);
  const timeTakenSec = report.submitted_at
    ? (new Date(report.submitted_at) - new Date(report.started_at)) / 1000
    : null;

  const viewingSomeoneElse = !report.is_owner;
  const viewerInTop10 = board.some((b) => b.user_id === report.viewer_user_id);
  const showYourResult = declared && report.viewer_rank && !viewerInTop10;

  content.innerHTML = `
    <div class="card">
      <div class="section-title">
        <h2 style="font-size:17px;">${escapeHtml(report.test_title)} ${categoryBadge(report.category)}</h2>
        <span class="status-tag ${report.status}">${report.status.replace("_", " ")}</span>
      </div>
      <p class="text-muted" style="font-size:13px;">
        ${viewingSomeoneElse ? `Top-3 public report · ${escapeHtml(report.full_name || "Student")} · ` : ""}Submitted ${formatDateTime(report.submitted_at)}
      </p>
    </div>

    ${
      !declared
        ? `<div class="locked-banner">Your score is available. Rank and percentile will be announced when the admin declares the results.</div>`
        : ""
    }

    <div class="stat-grid">
      <div class="stat-card"><div class="val">${report.total_score} / ${totalMax}</div><div class="lbl">Score</div></div>
      <div class="stat-card"><div class="val">${declared ? `${medalFor(report.rank)}#${report.rank}` : "🔒"}</div><div class="lbl">Rank${declared ? " of " + report.total_participants : ""}</div></div>
      <div class="stat-card"><div class="val">${declared ? report.percentile + "%" : "🔒"}</div><div class="lbl">Percentile</div></div>
      <div class="stat-card"><div class="val">${formatDurationPrecise(timeTakenSec)}</div><div class="lbl">Time taken</div></div>
    </div>

    <div class="card">
      <h2 style="font-size:16px;">Subject-wise performance</h2>
      <div class="table-scroll">
        <table class="report-table">
          <thead><tr><th>Subject</th><th>Correct</th><th>Wrong</th><th>Unattempted</th><th>Accuracy</th><th>Time taken</th><th>Marks</th><th></th></tr></thead>
          <tbody>
            ${subjectRows
              .map((r) => {
                const attempted =
                  Number(r.correct_count) + Number(r.wrong_count);
                const accuracy =
                  attempted > 0
                    ? Math.round((Number(r.correct_count) / attempted) * 100) +
                      "%"
                    : "—";
                return `
              <tr>
                <td>${subjectDot(r.subject)}${escapeHtml(r.subject)}</td>
                <td>${r.correct_count}</td>
                <td>${r.wrong_count}</td>
                <td>${r.unattempted}</td>
                <td>${accuracy}</td>
                <td>${formatDurationPrecise(r.time_spent_seconds)}</td>
                <td>${r.obtained} / ${r.total}</td>
                <td><div class="bar-track"><div class="bar-fill" style="width:${Math.max(0, Math.min(100, (r.obtained / r.total) * 100))}%"></div></div></td>
              </tr>
            `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    </div>

    ${
      report.is_owner || report.is_public_top3
        ? `
    <div class="card">
      <h2 style="font-size:16px;">Review ${viewingSomeoneElse ? "their" : "your"} incorrect answers</h2>
      ${
        incorrectAnswers.length === 0
          ? `<div class="empty-state">No incorrect answers — nice work! (Unattempted questions aren't shown here.)</div>`
          : incorrectAnswers.map(renderReviewQuestion).join("")
      }
    </div>`
        : ""
    }

    <div class="card">
      <h2 style="font-size:16px;">Leaderboard</h2>
      ${
        !declared
          ? `<div class="empty-state">Rank and percentile will be announced when the admin declares the results.</div>`
          : board.length === 0
            ? `<div class="empty-state">No submissions yet.</div>`
            : `
      <div class="table-scroll">
        <table class="report-table">
          <thead><tr><th>Rank</th><th>Student</th><th>Score</th><th>Percentile</th></tr></thead>
          <tbody>
            ${board
              .map(
                (r) => `
              <tr class="${rankRowClass(r.rnk)} ${r.user_id === report.viewer_user_id ? "me" : ""}">
                <td>${medalFor(r.rnk)}${r.rnk}</td><td>${escapeHtml(r.full_name || "Student")}${r.user_id === report.viewer_user_id ? " (you)" : ""}</td>
                <td>${r.total_score}</td><td>${r.percentile}%</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
      ${
        showYourResult
          ? `
      <div class="card your-rank-card" style="margin-top:12px;">
        <h2 style="font-size:14px;">Your Result</h2>
        <p style="font-size:14px;">Rank: #${report.viewer_rank} &nbsp;·&nbsp; Score: ${report.viewer_score} &nbsp;·&nbsp; Percentile: ${report.viewer_percentile}%</p>
        <a class="btn btn-sm btn-primary" href="#/result?attempt=${report.viewer_attempt_id}">View My Report</a>
      </div>`
          : ""
      }
      `
      }
    </div>
  `;
  renderMath(content);
}

/* =========================================================================
   8. BOOTSTRAP
   ========================================================================= */
function setupGlobalListeners() {
  document
    .querySelectorAll(".js-logout")
    .forEach((btn) => btn.addEventListener("click", logout));
}

setupTheme();
setupGlobalListeners();
setupLandingPage();
setupAuthListeners();
setupDashboardListeners();
setupAdminTestListeners();
setupExamStaticListeners();
router();

let feedbackRating = 0;
let pendingResult = null;
document.querySelectorAll("#feedbackModal [data-rating]").forEach((btn) =>
  btn.addEventListener("click", () => {
    feedbackRating = Number(btn.dataset.rating);
    document
      .querySelectorAll("#feedbackModal [data-rating]")
      .forEach((b) =>
        b.classList.toggle(
          "selected",
          Number(b.dataset.rating) === feedbackRating,
        ),
      );
  }),
);
document
  .getElementById("skipFeedbackBtn")
  .addEventListener("click", finishFeedback);
document.getElementById("cancelReportBtn").addEventListener("click", () => {
  reportingQuestion = null;
  closeModal("reportQuestionModal");
});
document
  .getElementById("submitReportBtn")
  .addEventListener("click", async () => {
    if (!reportingQuestion) return;
    const btn = document.getElementById("submitReportBtn");
    btn.disabled = true;
    const { error } = await sb.from("question_reports").insert({
      attempt_id: attemptId,
      test_id: testId,
      question_id: reportingQuestion.id,
      reason: document.getElementById("reportReason").value,
      details: document.getElementById("reportDetails").value.trim() || null,
    });
    btn.disabled = false;
    if (error) {
      toast(friendlyError(error), "error");
      return;
    }
    reportingQuestion = null;
    closeModal("reportQuestionModal");
    toast("Thanks — your report has been sent to the admins.", "success");
  });
document
  .getElementById("saveFeedbackBtn")
  .addEventListener("click", async () => {
    const btn = document.getElementById("saveFeedbackBtn");
    btn.disabled = true;
    const { error } = await sb.from("test_feedback").upsert(
      {
        attempt_id: attemptId,
        test_id: testId,
        rating: feedbackRating || null,
        comment: document.getElementById("feedbackText").value.trim() || null,
      },
      { onConflict: "attempt_id" },
    );
    btn.disabled = false;
    if (error) {
      toast(friendlyError(error), "error");
      return;
    }
    finishFeedback();
  });

function showFeedbackThenResult(data, reasonText) {
  pendingResult = {
    title: "Test submitted",
    text: `${reasonText} Your score: ${data.total_score} / ${totalMarks}.`,
    href: `#/result?attempt=${attemptId}`,
  };
  feedbackRating = 0;
  document.getElementById("feedbackText").value = "";
  document
    .querySelectorAll("#feedbackModal [data-rating]")
    .forEach((b) => b.classList.remove("selected"));
  openModal("feedbackModal");
}
function finishFeedback() {
  closeModal("feedbackModal");
  if (!pendingResult) return;
  showTerminal(
    pendingResult.title,
    pendingResult.text,
    pendingResult.href,
    "View your report",
  );
  pendingResult = null;
}

/* =========================================================
   LANDING PAGE (public front page)
   ========================================================= */
function setupLandingPage() {
  const root = document.getElementById("view-landing");
  if (!root) return;

  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  const titleLines = root.querySelectorAll("[data-typing-text]");
  if (titleLines.length) {
    const typeTitle = async () => {
      for (const line of titleLines) {
        const text = line.dataset.typingText || "";
        for (let i = 1; i <= text.length; i += 1) {
          line.textContent = text.slice(0, i);
          await new Promise((resolve) => setTimeout(resolve, 105));
        }
        await new Promise((resolve) => setTimeout(resolve, 130));
      }
    };
    typeTitle();
  }

  // Mobile hamburger menu
  const hamburger = document.getElementById("landingHamburger");
  const navLinks = document.getElementById("landingNavLinks");
  if (hamburger && navLinks) {
    hamburger.addEventListener("click", () => {
      const open = navLinks.classList.toggle("open");
      hamburger.classList.toggle("open", open);
      hamburger.setAttribute("aria-expanded", open ? "true" : "false");
    });
    navLinks.querySelectorAll("a").forEach((link) =>
      link.addEventListener("click", () => {
        navLinks.classList.remove("open");
        hamburger.classList.remove("open");
        hamburger.setAttribute("aria-expanded", "false");
      }),
    );
  }

  // Test-series popup — shown once per browser session
  const popup = document.getElementById("landingPopup");
  const popupClose = document.getElementById("landingPopupClose");
  if (popup && popupClose) {
    popupClose.addEventListener("click", () => closeModal("landingPopup"));
    document.getElementById("landingPopupCta")?.addEventListener("click", () => {
      closeModal("landingPopup");
      toast("Opening the free test series. Prizes included!", "success");
    });
    popup.addEventListener("click", (e) => {
      if (e.target === popup) closeModal("landingPopup");
    });
  }
  function maybeShowPopup() {
    if (!popup) return;
    if (sessionStorage.getItem("jee_landing_popup_shown")) return;
    sessionStorage.setItem("jee_landing_popup_shown", "1");
    setTimeout(() => openModal("landingPopup"), 600);
  }

  // Follower counter — animates once when the hero scrolls into view
  const counterEl = document.getElementById("followerCount");
  const TARGET_FOLLOWERS = 800;
  let counted = false;
  function runCounter() {
    if (counted || !counterEl) return;
    counted = true;
    if (reduceMotion) {
      counterEl.textContent = TARGET_FOLLOWERS;
      return;
    }
    const duration = 900;
    const start = performance.now();
    function step(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      counterEl.textContent = Math.round(eased * TARGET_FOLLOWERS);
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // Scroll-reveal for feature/community cards
  const revealTargets = root.querySelectorAll(
    ".landing-feature-card, .landing-community-card",
  );
  if (revealTargets.length) {
    if (reduceMotion || !("IntersectionObserver" in window)) {
      revealTargets.forEach((el) => el.classList.add("in-view"));
    } else {
      const revealObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("in-view");
              revealObserver.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.15 },
      );
      revealTargets.forEach((el) => revealObserver.observe(el));
    }
  }

  if ("IntersectionObserver" in window) {
    const heroObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            runCounter();
            heroObserver.disconnect();
          }
        });
      },
      { threshold: 0.3 },
    );
    const hero = document.querySelector(".landing-hero");
    if (hero) heroObserver.observe(hero);
  }

  // Show the popup the first time the landing view actually becomes active,
  // not merely on page load (so it never appears behind other views).
  const landingViewObserver = new MutationObserver(() => {
    if (root.classList.contains("active")) {
      maybeShowPopup();
      runCounter();
    }
  });
  landingViewObserver.observe(root, {
    attributes: true,
    attributeFilter: ["class"],
  });
  if (root.classList.contains("active")) {
    maybeShowPopup();
    runCounter();
  }
}

/* =========================================================
   THEME SYSTEM
   Default: LIGHT
   Remembers user's choice
   ========================================================= */

function applyTheme(theme) {
  const safeTheme = theme === "dark" ? "dark" : "light";

  document.documentElement.setAttribute("data-theme", safeTheme);

  localStorage.setItem("jee_theme", safeTheme);

  const btn = document.getElementById("themeToggle");

  if (btn) {
    btn.textContent = safeTheme === "dark" ? "☀️" : "🌙";

    btn.setAttribute(
      "aria-label",
      safeTheme === "dark" ? "Switch to light theme" : "Switch to dark theme",
    );

    btn.title =
      safeTheme === "dark" ? "Switch to light theme" : "Switch to dark theme";
  }
}

function toggleTheme() {
  const current =
    document.documentElement.getAttribute("data-theme") || "light";

  applyTheme(current === "dark" ? "light" : "dark");
}

function setupTheme() {
  const savedTheme = localStorage.getItem("jee_theme") || "light";

  applyTheme(savedTheme);

  const btn = document.getElementById("themeToggle");

  if (btn) {
    btn.addEventListener("click", toggleTheme);
  }
} 
