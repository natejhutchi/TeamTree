import { Icon } from "./Icon";

export function LogoutModal({
  accountEmail,
  closeLogoutModal,
  confirmLogout,
  isLogoutClosing,
  isLogoutOpen,
  onSaveUsername,
  teamName,
  username,
  usernameDraft,
  setUsernameDraft,
}: {
  accountEmail: string;
  closeLogoutModal: () => void;
  confirmLogout: () => void;
  isLogoutClosing: boolean;
  isLogoutOpen: boolean;
  onSaveUsername: () => void;
  teamName: string;
  username: string;
  usernameDraft: string;
  setUsernameDraft: React.Dispatch<React.SetStateAction<string>>;
}) {
  if (!isLogoutOpen && !isLogoutClosing) {
    return null;
  }

  const hasUsernameChanges = usernameDraft.trim() !== username.trim();

  return (
    <div className={`notepad-shell account-shell logout-shell ${isLogoutClosing ? "is-closing" : ""}`} role="dialog" aria-modal="true" aria-label="Log out">
      <div className={`notepad-panel account-panel logout-panel ${isLogoutClosing ? "is-closing" : ""}`}>
        <div className="notepad-header">
          <h2>Account</h2>
          <button aria-label="Cancel logout" className="notepad-icon-button" onClick={closeLogoutModal} type="button">
            <Icon name="x" />
          </button>
        </div>

        <div className="logout-identity">
          <p>Logged in as {accountEmail || "User"}</p>
          <p>Registered by {teamName || "TeamTown"}</p>
        </div>

        <div className="logout-username-card">
          <h3>Username</h3>
          <div className="logout-name-row">
            <input
              aria-label="Username"
              className="top-name-input logout-name-input"
              maxLength={30}
              onChange={(event) => setUsernameDraft(event.target.value)}
              placeholder="Name"
              type="text"
              value={usernameDraft}
            />
            <button className="logout-set-button" disabled={!hasUsernameChanges} onClick={onSaveUsername} type="button">
              Set
            </button>
          </div>
        </div>

        <div className="logout-actions">
          <button className="logout-text-button" onClick={closeLogoutModal} type="button">Cancel</button>
          <button className="notepad-add logout-confirm-button" onClick={confirmLogout} type="button">Log out</button>
        </div>
      </div>
    </div>
  );
}