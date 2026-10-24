/* =====================================================================
   LoginView: the Log In window for the one admin account (no sign-up).
   The view only draws the form and checks the fields; the controller
   sends them to the auth service and reports the result back here.
   Passwords are never stored by SPIRO.
   ===================================================================== */

import { $, $$, icon } from "../utils/dom.js";

export const LoginView = {
  /* handlers.onSubmit({ username, password }) returns a Promise. */
  open(handlers, opener) {
    const m = $("#loginModal");
    this._opener = this._opener || opener || document.activeElement;
    this._handlers = handlers;
    m.innerHTML = `<div class="modal-in">
      <div class="modal-head"><h2 id="loginTitle">Log In</h2>
        <button type="button" class="icon-btn" id="loginClose" aria-label="Close">${icon("i-close")}</button></div>
      <form id="loginForm" novalidate>
        <div class="field"><label for="lgUser">Username</label><input type="text" id="lgUser" autocomplete="username" autocapitalize="none" spellcheck="false" aria-describedby="lgUser-e"><span class="err" id="lgUser-e" hidden></span></div>
        <div class="field"><label for="lgPass">Password</label><input type="password" id="lgPass" autocomplete="current-password" aria-describedby="lgPass-e"><span class="err" id="lgPass-e" hidden></span></div>
        <p class="err" id="lgForm-e" role="alert" hidden></p>
        <div class="form-actions"><button type="submit" class="btn np-login" id="loginSubmit">Log-In</button></div>
        <p class="small muted login-note">For LGU administrators only.</p>
      </form>
    </div>`;
    m.hidden = false; $("#modalScrim").hidden = false;
    $("#loginClose").addEventListener("click", () => this.close());
    $("#loginForm").addEventListener("submit", e => { e.preventDefault(); this.submit(); });
    $("#lgUser").focus();
  },

  async submit() {
    const username = $("#lgUser").value.trim(), pass = $("#lgPass").value, errs = {};
    if (!username) errs.lgUser = "Enter your username.";
    if (!pass) errs.lgPass = "Enter a password.";
    $$("#loginForm .err").forEach(x => { x.hidden = true; x.textContent = ""; });
    $$("#loginForm [aria-invalid]").forEach(x => x.removeAttribute("aria-invalid"));
    Object.entries(errs).forEach(([k, msg]) => { const er = $("#" + k + "-e"); er.textContent = msg; er.hidden = false; $("#" + k).setAttribute("aria-invalid", "true"); });
    if (Object.keys(errs).length) { $("#" + Object.keys(errs)[0]).focus(); return; }

    const btn = $("#loginSubmit"), label = btn.textContent;
    btn.disabled = true; btn.textContent = "Logging in…";
    try {
      await this._handlers.onSubmit({ username, password: pass });
    } catch (err) {
      this.showError(err?.message || "Something went wrong. Try again.");
    } finally {
      if (!$("#loginModal").hidden && $("#loginSubmit")) { btn.disabled = false; btn.textContent = label; }
    }
  },

  /* A message under the form (textContent only, never HTML). */
  showError(msg) { const e = $("#lgForm-e"); if (!e) return; e.textContent = msg; e.hidden = false; },

  close() {
    const m = $("#loginModal"); if (m.hidden) return;
    m.hidden = true; m.innerHTML = ""; $("#modalScrim").hidden = true;
    this._opener?.focus?.(); this._opener = null;
  },
  isOpen() { return !$("#loginModal").hidden; }
};
