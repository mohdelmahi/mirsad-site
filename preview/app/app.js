(function () {
  const $ = (s) => document.querySelector(s);
  const show = (el, on = true) => { el.hidden = !on; };
  let interval = "year";
  let recovering = false;

  // ---------- helpers ----------
  function msg(el, text, kind) { el.textContent = text || ""; el.className = "msg" + (el.classList.contains("inline") ? " inline" : "") + (kind ? " " + kind : ""); }
  function fmtDate(d) { return d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—"; }
  function money(amount, cur) {
    if (amount == null) return "";
    return new Intl.NumberFormat("en", { style: "currency", currency: (cur || "usd").toUpperCase() }).format(amount / 100);
  }
  async function callFn(name, body) {
    const { data: { session } } = await sb.auth.getSession();
    const res = await fetch(`${MIRSAD.functionsUrl}/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}`, apikey: MIRSAD.supabaseKey },
      body: JSON.stringify(body || {}),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || "Something went wrong.");
    return out;
  }

  // ---------- auth views ----------
  function authView(which) {
    ["signin", "signup", "forgot", "reset"].forEach((v) => show($("#f-" + v), v === which));
    document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === which));
    show($(".tabs"), which === "signin" || which === "signup");
    msg($("#auth-msg"), "");
  }
  document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => authView(b.dataset.tab)));
  $("#to-forgot").addEventListener("click", () => authView("forgot"));
  document.querySelectorAll("[data-back]").forEach((b) => b.addEventListener("click", () => authView("signin")));

  $("#f-signin").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    msg($("#auth-msg"), "Signing in…");
    const { error } = await sb.auth.signInWithPassword({ email: f.get("email"), password: f.get("password") });
    if (error) msg($("#auth-msg"), error.message === "Email not confirmed" ? "Please confirm your email first. Check your inbox for our link." : "Email or password is not right.", "err");
  });

  $("#f-signup").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    msg($("#auth-msg"), "Creating your account…");
    const { data, error } = await sb.auth.signUp({
      email: f.get("email"), password: f.get("password"),
      options: { emailRedirectTo: location.origin + "/app/", data: { full_name: f.get("full_name"), phone: f.get("phone") } },
    });
    if (error) return msg($("#auth-msg"), error.message, "err");
    if (!data.session) { e.target.reset(); msg($("#auth-msg"), "Almost done. We've sent you an email. Click the link in it to confirm your account.", "ok"); }
  });

  $("#f-forgot").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = new FormData(e.target).get("email");
    await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + "/app/" });
    msg($("#auth-msg"), "If that email has an account, a reset link is on its way.", "ok");
  });

  $("#f-reset").addEventListener("submit", async (e) => {
    e.preventDefault();
    const { error } = await sb.auth.updateUser({ password: new FormData(e.target).get("password") });
    if (error) return msg($("#auth-msg"), error.message, "err");
    recovering = false;
    msg($("#auth-msg"), "Password saved.", "ok");
    route();
  });

  $("#signout").addEventListener("click", async () => { await sb.auth.signOut(); });

  // ---------- dashboard ----------
  function renderPlan(sub) {
    const box = $("#plan-box");
    const active = sub && ["active", "trialing", "past_due"].includes(sub.status);
    show($("#choose"), !active);
    if (!active) {
      box.innerHTML = `<p class="big">Free</p><p class="muted">You're on the free launch access. Choose a plan below when you're ready.</p>`;
      return null;
    }
    const name = sub.plan === "professional" ? "Professional" : "Starter";
    const per = sub.billing_interval === "year" ? "year" : "month";
    const statusNote = sub.status === "past_due"
      ? `<p class="msg err">Your last payment didn't go through. Please update your card in Manage billing.</p>`
      : sub.cancel_at_period_end
        ? `<p class="muted">Cancelled. You keep access until <b>${fmtDate(sub.current_period_end)}</b>.</p>`
        : `<p class="muted">Renews on <b>${fmtDate(sub.current_period_end)}</b>.</p>`;
    box.innerHTML = `<p class="big">${name} <span class="pill">${per === "year" ? "Yearly" : "Monthly"}</span></p>
      <p>${money(sub.amount, sub.currency)} / ${per}</p>${statusNote}
      <button class="btn ghost" id="manage">Manage billing</button>
      <p class="small muted">Change plan, update your card, download invoices or cancel.</p>`;
    $("#manage").addEventListener("click", openPortal);
    return sub.plan;
  }

  function renderUsage(usage, plan) {
    const lim = MIRSAD.limits[plan] || MIRSAD.limits.starter;
    const t = usage?.tracked_products || 0, s = usage?.searches || 0;
    const fmt = (n, max) => (max === Infinity ? `${n} (unlimited)` : `${n} of ${max}`);
    $("#u-tracked").textContent = fmt(t, lim.tracked);
    $("#u-searches").textContent = fmt(s, lim.searches);
    $("#b-tracked").style.width = lim.tracked === Infinity ? "4%" : Math.min(100, (t / lim.tracked) * 100) + "%";
    $("#b-searches").style.width = lim.searches === Infinity ? "4%" : Math.min(100, (s / lim.searches) * 100) + "%";
  }

  async function loadDash(user) {
    const month = new Date(); month.setDate(1);
    const monthStr = month.toISOString().slice(0, 10);
    const [{ data: profile }, { data: sub }, { data: usage }] = await Promise.all([
      sb.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      sb.from("subscriptions").select("*").eq("user_id", user.id).maybeSingle(),
      sb.from("usage").select("*").eq("user_id", user.id).eq("month", monthStr).maybeSingle(),
    ]);
    const p = profile || {};
    $("#hello-name").textContent = (p.full_name || user.email).split(" ")[0];
    const form = $("#f-profile");
    ["full_name", "phone", "country", "address_line1", "address_line2", "city"].forEach((k) => { form.elements[k].value = p[k] || ""; });
    form.elements.email.value = user.email;
    const plan = renderPlan(sub);
    renderUsage(usage, plan || "starter");
    return sub;
  }

  $("#f-profile").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target.elements;
    const { data: { user } } = await sb.auth.getUser();
    const patch = {};
    ["full_name", "phone", "country", "address_line1", "address_line2", "city"].forEach((k) => { patch[k] = f[k].value.trim() || null; });
    const { error } = await sb.from("profiles").update(patch).eq("id", user.id);
    msg($("#profile-msg"), error ? "Couldn't save. Please try again." : "Saved.", error ? "err" : "ok");
    if (!error) $("#hello-name").textContent = (patch.full_name || user.email).split(" ")[0];
  });

  // plan picker
  document.querySelectorAll(".toggle button").forEach((b) => b.addEventListener("click", () => {
    interval = b.dataset.int;
    document.querySelectorAll(".toggle button").forEach((x) => x.classList.toggle("on", x === b));
    document.querySelectorAll(".price").forEach((p) => { p.textContent = p.dataset[interval === "month" ? "m" : "y"]; });
  }));
  document.querySelectorAll("[data-plan]").forEach((b) => b.addEventListener("click", async () => {
    b.disabled = true; const label = b.textContent; b.textContent = "Opening checkout…";
    try { const { url } = await callFn("create-checkout", { plan: `${b.dataset.plan}-${interval}` }); location.href = url; }
    catch (err) { msg($("#banner"), err.message, "err"); b.disabled = false; b.textContent = label; }
  }));

  async function openPortal(e) {
    const b = e.currentTarget; b.disabled = true; b.textContent = "Opening…";
    try { const { url } = await callFn("create-portal"); location.href = url; }
    catch (err) { msg($("#banner"), err.message, "err"); b.disabled = false; b.textContent = "Manage billing"; }
  }

  // ---------- routing ----------
  async function route() {
    const { data: { session } } = await sb.auth.getSession();
    show($("#loading"), false);
    show($("#signout"), !!session && !recovering);
    if (!session || recovering) { show($("#dash"), false); show($("#auth"), true); if (recovering) authView("reset"); return; }
    show($("#auth"), false); show($("#dash"), true);
    let sub = await loadDash(session.user);

    const q = new URLSearchParams(location.search);
    if (q.get("checkout") === "success") {
      history.replaceState(null, "", location.pathname);
      msg($("#banner"), "Thank you! Confirming your payment…", "ok");
      for (let i = 0; i < 8 && !(sub && sub.status === "active"); i++) {
        await new Promise((r) => setTimeout(r, 2000));
        sub = await loadDash(session.user);
      }
      msg($("#banner"), sub && sub.status === "active" ? "Payment confirmed. Your plan is active." : "Payment received. Your plan will show here in a minute.", "ok");
    } else if (q.get("checkout") === "cancelled") {
      history.replaceState(null, "", location.pathname);
      msg($("#banner"), "Checkout was cancelled. You weren't charged.");
    }
  }

  sb.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") recovering = true;
    if (["SIGNED_IN", "SIGNED_OUT", "PASSWORD_RECOVERY"].includes(event)) setTimeout(route, 0);
  });
  route();
})();
