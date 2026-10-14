// The public web build runs this before Expo Router reads the initial URL.
// Keep recovery credentials only in memory while the auth server verifies them.
if (window.location.pathname === "/reset-password") {
  const recoveryUrl = new URL(window.location.href);
  if (
    recoveryUrl.hash ||
    recoveryUrl.searchParams.has("code") ||
    recoveryUrl.searchParams.has("token_hash") ||
    recoveryUrl.searchParams.has("error")
  ) {
    window.__SHIFTLINE_RECOVERY_LINK__ = recoveryUrl.href;
    // Navigation can replay its original callback URL after a session change.
    // Prevent that replay from putting credentials back into browser history.
    const cleanRecoveryUrl = (href) => {
      if (href == null) return href;
      const target = new URL(href, window.location.href);
      return target.origin === window.location.origin &&
        target.pathname === "/reset-password"
        ? "/reset-password"
        : href;
    };
    const replace = window.history.replaceState.bind(window.history);
    const push = window.history.pushState.bind(window.history);
    window.history.replaceState = (state, title, href) =>
      replace(state, title, cleanRecoveryUrl(href));
    window.history.pushState = (state, title, href) =>
      push(state, title, cleanRecoveryUrl(href));
    window.history.replaceState(window.history.state, "", "/reset-password");
  }
}
