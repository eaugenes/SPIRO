/* =====================================================================
   Auth service: log-in and log-out for the one admin account.
   The check runs in the browser, so anyone can read the username and
   password in this file. It only hides the Admin tools from ordinary
   visitors; it is not real security. Nothing here is sent to a server.
   ===================================================================== */

const ADMIN = Object.freeze({ username: "admin", password: "admin" });

export const AuthService = {
  /* Resolves when the username and password match; otherwise throws a plain-language error. */
  async logIn(username, password) {
    if (username !== ADMIN.username || password !== ADMIN.password) throw new Error("The username or password is not correct.");
    return { username };
  },

  /* Nothing to sign out of: the log-in lives only in this browser tab (see app-model.js). */
  async logOut() {}
};
