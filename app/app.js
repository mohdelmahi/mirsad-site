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
    await loadTracker(user, sub && ["active", "trialing", "past_due"].includes(sub.status) ? plan : null);
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

  // ---------- product tracker ----------
  const MP_NAME = { "amazon.ae": "UAE", "amazon.sa": "KSA", "amazon.eg": "Egypt" };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (n) => (n == null ? "—" : Number(n).toLocaleString("en"));
  let trPlan = null, trOpen = null;

  function parseProduct(q, fallbackMp) {
    q = q.trim();
    const host = q.match(/amazon\.(ae|sa|eg)\b/i);
    const asin = (q.match(/(?:\/dp\/|\/gp\/product\/|\/product\/|asin=)([A-Z0-9]{10})/i) || q.match(/^([A-Z0-9]{10})$/i) || [])[1];
    const otherAmazon = !host && /amazon\.[a-z.]+/i.test(q);
    return { asin: asin ? asin.toUpperCase() : null, mp: host ? "amazon." + host[1].toLowerCase() : otherAmazon ? "other" : fallbackMp };
  }

  function spark(vals, invert) {
    const v = vals.filter((x) => x != null);
    if (v.length < 2) return '<span class="small muted">—</span>';
    const min = Math.min(...v), max = Math.max(...v), w = 90, h = 26;
    const pts = v.map((x, i) => {
      const y = max === min ? h / 2 : invert ? ((x - min) / (max - min)) * (h - 4) + 2 : h - 2 - ((x - min) / (max - min)) * (h - 4);
      return `${((i / (v.length - 1)) * w).toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><polyline points="${pts}"/></svg>`;
  }

  function change(cur, prev, lowerIsBetter) {
    if (cur == null || prev == null || cur === prev) return "";
    const better = lowerIsBetter ? cur < prev : cur > prev;
    const d = Math.abs(cur - prev);
    return ` <small class="${better ? "up" : "down"}">${better ? "▲" : "▼"} ${num(Math.round(d * 100) / 100)}</small>`;
  }

  function chart(rows, key, label, invert) {
    const pts = rows.filter((r) => r[key] != null);
    if (pts.length < 2) return `<div class="chart"><b>${label}</b><p class="small muted">The chart appears after two daily checks.</p></div>`;
    const vals = pts.map((r) => Number(r[key])), min = Math.min(...vals), max = Math.max(...vals);
    const W = 460, H = 150, P = 28;
    const x = (i) => P + (i / (pts.length - 1)) * (W - P - 8);
    const y = (v) => max === min ? H / 2 : invert ? 10 + ((v - min) / (max - min)) * (H - 30) : H - 20 - ((v - min) / (max - min)) * (H - 30);
    const line = pts.map((r, i) => `${x(i).toFixed(1)},${y(Number(r[key])).toFixed(1)}`).join(" ");
    const dots = pts.map((r, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(Number(r[key])).toFixed(1)}" r="3"><title>${r.captured_on}: ${num(r[key])}</title></circle>`).join("");
    const top = invert ? min : max, bottom = invert ? max : min;
    return `<div class="chart"><b>${label}</b><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${label} over time">
      <text x="2" y="14">${num(top)}</text><text x="2" y="${H - 22}">${num(bottom)}</text>
      <text x="${P}" y="${H - 4}">${pts[0].captured_on}</text><text x="${W - 8}" y="${H - 4}" text-anchor="end">${pts[pts.length - 1].captured_on}</text>
      <polyline points="${line}"/>${dots}</svg></div>`;
  }

  async function loadTracker(user, plan) {
    trPlan = plan;
    const box = $("#tr-list");
    const { data: tracked, error } = await sb.from("tracked").select("marketplace,asin,created_at").eq("user_id", user.id).order("created_at");
    if (error) { box.innerHTML = '<p class="msg err">Couldn\'t load your tracked products. Please refresh.</p>'; return; }
    const lim = (MIRSAD.limits[plan] || { tracked: 0 }).tracked;
    $("#tr-count").textContent = plan ? (lim === Infinity ? `${tracked.length} tracked` : `${tracked.length} of ${lim} tracked`) : "";
    $("#u-tracked").textContent = lim === Infinity ? `${tracked.length} (unlimited)` : `${tracked.length} of ${lim || 0}`;
    $("#b-tracked").style.width = lim === Infinity ? "4%" : lim ? Math.min(100, (tracked.length / lim) * 100) + "%" : "0%";
    if (!tracked.length) {
      box.innerHTML = plan
        ? '<p class="empty">You aren\'t tracking anything yet. Paste an Amazon link or ASIN above to start.</p>'
        : '<p class="empty">Choose a plan to start tracking products. Starter tracks 5 products, Professional tracks as many as you like.</p>';
      return;
    }
    const asins = [...new Set(tracked.map((t) => t.asin))];
    const since = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
    const [{ data: prods }, { data: snaps }] = await Promise.all([
      sb.from("products").select("marketplace,asin,title,image").in("asin", asins),
      sb.from("snapshots").select("marketplace,asin,captured_on,price,currency,bsr,bsr_category,rating,reviews,bought_past_month,bought_min").in("asin", asins).gte("captured_on", since).order("captured_on"),
    ]);
    const key = (r) => r.marketplace + "|" + r.asin;
    const P = {}, S = {};
    (prods || []).forEach((p) => { P[key(p)] = p; });
    (snaps || []).forEach((s) => { (S[key(s)] ||= []).push(s); });

    box.innerHTML = `<div class="tablewrap"><table class="tr-table"><thead><tr><th>Product</th><th>Price</th><th>BSR</th><th>BSR trend</th><th>Bought last month</th><th>Rating</th><th></th></tr></thead><tbody>${
      tracked.map((t) => {
        const k = key(t), p = P[k] || {}, h = S[k] || [], last = h[h.length - 1], prev = h[h.length - 2];
        const link = `https://www.${t.marketplace}/dp/${t.asin}`;
        const name = p.title ? esc(p.title.length > 60 ? p.title.slice(0, 60) + "…" : p.title) : `<span class="muted">${t.asin}</span>`;
        const img = p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy">` : '<span class="noimg"></span>';
        const cells = last
          ? `<td>${last.price != null ? esc(last.currency || "") + "&nbsp;" + Number(last.price).toFixed(2) : "—"}${change(last.price, prev?.price, true)}</td>
             <td>${last.bsr ? "#" + num(last.bsr) : "—"}${change(last.bsr, prev?.bsr, true)}${last.bsr_category ? `<small class="muted cat">${esc(last.bsr_category)}</small>` : ""}</td>
             <td>${spark(h.map((r) => r.bsr), true)}</td>
             <td>${esc((last.bought_past_month || "—").replace(/\s*bought in past month/i, ""))}</td>
             <td>${last.rating ? last.rating + " ★ (" + num(last.reviews) + ")" : "—"}</td>`
          : `<td colspan="5" class="muted small">Waiting for the first daily check</td>`;
        return `<tr data-k="${esc(k)}"><td class="prod">${img}<div><a href="${link}" target="_blank" rel="noopener">${name}</a><small class="muted">${MP_NAME[t.marketplace]} · ${t.asin}${h.length ? ` · ${h.length} day${h.length > 1 ? "s" : ""} of data` : ""}</small></div></td>${cells}
          <td class="acts"><button class="link" data-hist="${esc(k)}"${h.length ? "" : " disabled"}>History</button><button class="link danger" data-rm="${esc(k)}">Remove</button></td></tr>
          <tr class="hist" data-for="${esc(k)}" hidden><td colspan="7">${h.length ? chart(h, "bsr", "Best Sellers Rank (higher on chart is better)", true) + chart(h, "price", "Price", false) : ""}</td></tr>`;
      }).join("")
    }</tbody></table></div>`;

    box.querySelectorAll("[data-hist]").forEach((b) => b.addEventListener("click", () => {
      const row = box.querySelector(`tr.hist[data-for="${b.dataset.hist}"]`);
      row.hidden = !row.hidden; b.textContent = row.hidden ? "History" : "Hide";
    }));
    box.querySelectorAll("[data-rm]").forEach((b) => b.addEventListener("click", async () => {
      const [mp, asin] = b.dataset.rm.split("|");
      if (b.dataset.sure !== "1") { b.dataset.sure = "1"; b.textContent = "Confirm remove"; setTimeout(() => { b.dataset.sure = ""; b.textContent = "Remove"; }, 4000); return; }
      b.disabled = true;
      const { error: e } = await sb.from("tracked").delete().eq("user_id", user.id).eq("marketplace", mp).eq("asin", asin);
      msg($("#track-msg"), e ? "Couldn't remove it. Please try again." : `Stopped tracking ${asin}.`, e ? "err" : "ok");
      loadTracker(user, trPlan);
    }));
  }

  $("#f-track").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target.elements, m = $("#track-msg");
    const { asin, mp } = parseProduct(f.q.value, f.mp.value);
    if (!asin) { msg(m, "That doesn't look like an Amazon product link or ASIN. An ASIN is 10 letters and numbers, like B0DLBJST8X.", "err"); return; }
    if (!MP_NAME[mp]) { msg(m, "Mirsad tracks Amazon UAE, Saudi Arabia and Egypt only.", "err"); return; }
    const btn = e.target.querySelector("button"); btn.disabled = true;
    const { data: { user } } = await sb.auth.getUser();
    const { error } = await sb.from("tracked").insert({ user_id: user.id, marketplace: mp, asin });
    btn.disabled = false;
    if (error) {
      const text = error.code === "23505" ? `You're already tracking ${asin} in ${MP_NAME[mp]}.`
        : /allows 0/.test(error.message) ? "Choose a plan to start tracking products."
        : /allows/.test(error.message) ? error.message : "Couldn't add it. Please try again.";
      msg(m, text, "err"); return;
    }
    f.q.value = "";
    msg(m, `Now tracking ${asin} in ${MP_NAME[mp]}.`, "ok");
    loadTracker(user, trPlan);
  });

  // ---------- routing ----------
  async function route() {
    const { data: { session } } = await sb.auth.getSession();
    show($("#loading"), false);
    show($("#signout"), !!session && !recovering);
    if (!session || recovering) { show($("#dash"), false); show($("#auth"), true); if (recovering) authView("reset"); else if (location.hash === "#signup") authView("signup"); return; }
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
