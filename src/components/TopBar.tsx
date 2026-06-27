import { Icon } from "./Icon";

export function TopBar({
  announcements,
  hiddenAnnouncementIndexes,
  isFront,
  isTopBarOpen,
  onLogout,
  prospectName,
  repName,
  setActiveOverlay,
  setHiddenAnnouncementIndexes,
  setIsTopBarOpen,
  setProspectName,
  setRepName,
}: {
  announcements: string[];
  hiddenAnnouncementIndexes: number[];
  isFront: boolean;
  isTopBarOpen: boolean;
  onLogout: () => void;
  prospectName: string;
  repName: string;
  setActiveOverlay: React.Dispatch<React.SetStateAction<"top" | "team" | "bottom" | "objections">>;
  setHiddenAnnouncementIndexes: React.Dispatch<React.SetStateAction<number[]>>;
  setIsTopBarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setProspectName: React.Dispatch<React.SetStateAction<string>>;
  setRepName: React.Dispatch<React.SetStateAction<string>>;
}) {
  const hasVisibleAnnouncements = announcements.some((_, index) => !hiddenAnnouncementIndexes.includes(index));

  return (
    <header
      className={`top-bar ${isTopBarOpen ? "is-open" : "is-collapsed"} ${isFront ? "is-front" : ""} ${hasVisibleAnnouncements ? "has-announcements" : "has-no-announcements"}`}
      aria-label="TeamTownTree toolbar"
    >
      <div className="top-bar-content">
        <div className="top-bar-row">
          <h1 className="top-bar-title">TeamTown<span className="top-bar-title-tree">Tree</span></h1>

          <div className="top-bar-names">
            <input
              aria-label="Prospect name"
              className="top-name-input"
              onChange={(event) => setProspectName(event.target.value)}
              placeholder="Prospect"
              type="text"
              value={prospectName}
            />
            <input
              aria-label="Rep name"
              className="top-name-input"
              onChange={(event) => setRepName(event.target.value)}
              placeholder="Rep"
              type="text"
              value={repName}
            />
          </div>
          <div className="top-bar-actions">
            <a
              aria-label="Log out"
              className="account-link"
              href="#logout"
              onClick={(event) => {
                event.preventDefault();
                onLogout();
              }}
            >
              <Icon name="userRound" />
            </a>
          </div>
        </div>

        <div className="top-bar-notes" aria-live="polite">
          {announcements.map((announcement, index) =>
            hiddenAnnouncementIndexes.includes(index) ? null : (
              <div className="top-note" key={announcement}>
                <button
                  aria-label="Dismiss announcement"
                  className="top-note-dismiss"
                  onClick={() => setHiddenAnnouncementIndexes((hiddenIndexes) => [...hiddenIndexes, index])}
                  type="button"
                >
                  <Icon name="x" />
                </button>
                <span>{announcement}</span>
              </div>
            ),
          )}
        </div>
      </div>

      <button
        aria-label={isTopBarOpen ? "Collapse toolbar" : "Expand toolbar"}
        className="top-bar-toggle"
        onClick={() => {
          if (!isTopBarOpen) {
            setActiveOverlay("top");
          }
          setIsTopBarOpen((isOpen) => !isOpen);
        }}
        type="button"
      >
        <Icon name="badge" />
      </button>
    </header>
  );
}
