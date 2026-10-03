import { createFileRoute } from "@tanstack/react-router";

/**
 * Formulário embed: um <script> que se coloca na página externa (WordPress, Elementor,
 * Framer, Webflow, HTML). Desenha o formulário num shadow DOM (o CSS da página não o
 * estraga), lê as UTM e o referrer da página onde está, e envia para /api/public/register.
 *
 *   <script src="https://<app>/api/public/forms/<id>/embed" async></script>
 *
 * Para o colocar num sítio certo: <div data-convertewebinar-form="<id>"></div> antes do script.
 */
const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const js = (body: string, status = 200) =>
  new Response(body, {
    status,
    headers: {
      "content-type": "text/javascript; charset=utf-8",
      "cache-control": "public, max-age=60",
      "access-control-allow-origin": "*",
    },
  });

export const Route = createFileRoute("/api/public/forms/$formId/embed")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!/^[0-9a-f-]{36}$/i.test(params.formId)) return js("console.warn('Convertewebinar: formulário inválido');", 404);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: form } = await supabaseAdmin
          .from("registration_forms")
          .select("id, active, ask_phone, require_phone, consent_text, webinars(public_title, internal_name, status)")
          .eq("id", params.formId)
          .maybeSingle();
        if (!form || !form.active || form.webinars?.status === "draft")
          return js("console.warn('Convertewebinar: formulário indisponível');", 404);

        const config = {
          formId: form.id,
          endpoint: `${new URL(request.url).origin}/api/public/register`,
          askPhone: form.ask_phone || form.require_phone,
          requirePhone: form.require_phone,
          consent: form.consent_text ? escapeHtml(form.consent_text) : null,
          title: escapeHtml(form.webinars?.public_title || form.webinars?.internal_name || "Webinar"),
        };
        // O JSON vai dentro de um script: "</" nunca pode fechar a tag.
        const cfg = JSON.stringify(config).replace(/</g, "\\u003c");
        return js(`(function () {
  var cfg = ${cfg};
  var script = document.currentScript;
  var host = document.querySelector('[data-convertewebinar-form="' + cfg.formId + '"]');
  if (!host) { host = document.createElement("div"); if (script && script.parentNode) script.parentNode.insertBefore(host, script); else document.body.appendChild(host); }
  if (host.getAttribute("data-cw-ready")) return;
  host.setAttribute("data-cw-ready", "1");
  var root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
  var sid = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
  root.innerHTML =
    '<style>' +
    ':host{all:initial}form{font:15px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111;display:grid;gap:10px;max-width:420px}' +
    'label{display:grid;gap:4px;font-size:13px;font-weight:600}input[type=text],input[type=email],input[type=tel]{font:inherit;padding:10px 12px;border:1px solid #d4d4d8;border-radius:10px;background:#fff;color:#111}' +
    'input:focus{outline:2px solid #e11d2e;outline-offset:1px}.consent{display:flex;gap:8px;align-items:flex-start;font-weight:400;font-size:12px;color:#444}' +
    'button{font:inherit;font-weight:700;padding:12px;border:0;border-radius:10px;background:#e11d2e;color:#fff;cursor:pointer}button[disabled]{opacity:.6;cursor:wait}' +
    '.err{color:#b91c1c;font-size:12px;font-weight:500}.ok{padding:14px;border-radius:10px;background:#ecfdf5;color:#065f46;font-weight:600}.hp{position:absolute;left:-9999px}' +
    '</style>' +
    '<form novalidate>' +
    '<label>Nome<input type="text" name="name" autocomplete="name" required></label>' +
    '<label>Email<input type="email" name="email" autocomplete="email" required></label>' +
    (cfg.askPhone ? '<label>WhatsApp' + (cfg.requirePhone ? '' : ' (opcional)') + '<input type="tel" name="phone" autocomplete="tel"' + (cfg.requirePhone ? ' required' : '') + '></label>' : '') +
    (cfg.consent ? '<label class="consent"><input type="checkbox" name="consent" required><span>' + cfg.consent + '</span></label>' : '') +
    '<input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">' +
    '<div class="err" role="alert"></div>' +
    '<button type="submit">Quero inscrever-me</button>' +
    '</form>';
  var form = root.querySelector("form");
  var err = root.querySelector(".err");
  // A origem é a da página de entrada: guardada na sessão do browser para quem navega no
  // site antes de se inscrever (a página do formulário já não traz as UTM nem o referrer).
  var params = new URLSearchParams(location.search);
  var keys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
  var utm = {};
  keys.forEach(function (k) { var v = params.get(k); if (v) utm[k] = v; });
  var ref = document.referrer || null;
  try {
    if (Object.keys(utm).length) sessionStorage.setItem("cw_utm", JSON.stringify(utm));
    else utm = JSON.parse(sessionStorage.getItem("cw_utm") || "{}");
    if (ref && new URL(ref).host !== location.host) sessionStorage.setItem("cw_ref", ref);
    else ref = sessionStorage.getItem("cw_ref") || ref;
  } catch (e) {}
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var button = form.querySelector("button");
    var val = function (n) { var el = form.querySelector('[name="' + n + '"]'); return el ? (el.type === "checkbox" ? el.checked : el.value) : null; };
    var payload = {
      form_id: cfg.formId, submission_id: sid,
      name: val("name"), email: val("email"), phone: val("phone") || null, consent: cfg.consent ? val("consent") : null,
      utm_source: utm.utm_source || null, utm_medium: utm.utm_medium || null, utm_campaign: utm.utm_campaign || null,
      utm_content: utm.utm_content || null, utm_term: utm.utm_term || null,
      referrer: ref, page_url: location.href,
      device: window.matchMedia && matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop",
      website: val("website")
    };
    err.textContent = ""; button.disabled = true;
    fetch(cfg.endpoint, { method: "POST", headers: { "content-type": "application/json", "x-convertewebinar-embed": "1" }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json().then(function (b) { return { ok: r.ok, body: b }; }); })
      .then(function (res) {
        if (!res.ok) {
          var f = res.body.fields || {};
          err.textContent = f.name || f.email || f.phone || f.consent || res.body.message || "Não foi possível concluir a inscrição.";
          button.disabled = false; return;
        }
        if (res.body.redirect_url) { location.href = res.body.redirect_url; return; }
        var ok = document.createElement("div"); ok.className = "ok"; ok.textContent = res.body.message || "Inscrição confirmada.";
        form.replaceWith(ok);
      })
      .catch(function () { err.textContent = "Sem ligação. Tente outra vez."; button.disabled = false; });
  });
})();
`);
      },
    },
  },
});
