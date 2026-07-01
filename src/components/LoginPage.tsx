import { Icon } from "./Icon";
import treeLogo from "../../resources/TreeLogo.png";

export function LoginPage({
  accessDenied = false,
  authError,
  isConfigured,
  isLoading,
  onGoogleLogin,
}: {
  accessDenied?: boolean;
  authError: string;
  isConfigured: boolean;
  isLoading: boolean;
  onGoogleLogin: () => void;
}) {
  return (
    <main className="login-page" aria-label="TeamTree login">
      <section className="login-panel">
        {accessDenied ? <h1 className="login-access-denied">Access Denied</h1> : null}
        <div className="login-brand" aria-label="TeamTree"><span>TeamTree</span></div>
        <img className="login-tree-logo" src={treeLogo} alt="" aria-hidden="true" />

        {accessDenied ? (
          <div className="login-rejection" role="alert">
            <button className="login-google-button" onClick={onGoogleLogin} type="button">
              <Icon name="userRound" />
              Continue with Google
            </button>
          </div>
        ) : (
          <button className="login-google-button" disabled={!isConfigured || isLoading} onClick={onGoogleLogin} type="button">
            <Icon name="userRound" />
            {isLoading ? "Checking access..." : "Continue with Google"}
          </button>
        )}

        {!isConfigured ? (
          <p className="login-error">
            Supabase is not configured yet. Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to your local env file.
          </p>
        ) : null}
        {authError && !accessDenied ? <p className="login-error">{authError}</p> : null}
      </section>
    </main>
  );
}



