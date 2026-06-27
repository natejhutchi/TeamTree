import { Icon } from "./Icon";

export function LoginPage({
  authError,
  isConfigured,
  isLoading,
  onGoogleLogin,
}: {
  authError: string;
  isConfigured: boolean;
  isLoading: boolean;
  onGoogleLogin: () => void;
}) {
  return (
    <main className="login-page" aria-label="ClosedCall login">
      <section className="login-panel">
        <p className="login-kicker">ClosedCall by TeamTown</p>
        <h1 className="login-logo">Closed<span>Call</span></h1>
        <p className="login-copy">
          Sign in with the Google account your employer enabled for this workspace.
        </p>

        <button className="login-google-button" disabled={!isConfigured || isLoading} onClick={onGoogleLogin} type="button">
          <Icon name="userRound" />
          {isLoading ? "Checking access..." : "Continue with Google"}
        </button>

        {!isConfigured ? (
          <p className="login-error">
            Supabase is not configured yet. Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to your local env file.
          </p>
        ) : null}
        {authError ? <p className="login-error">{authError}</p> : null}
      </section>
    </main>
  );
}
