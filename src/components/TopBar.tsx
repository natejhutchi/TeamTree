import { useEffect, useRef } from "react";
import treeLogo from "../../resources/TreeLogo.png";
import { Icon } from "./Icon";

export function TopBar({
  announcements,
  hiddenAnnouncementIndexes,
  noteDraft,
  notes,
  isFront,
  isTopBarOpen,
  isAdmin,
  onOpenLogout,
  onOpenSettings,
  onAddNote,
  onDeleteNote,
  prospectName,
  repName,
  setActiveOverlay,
  setHiddenAnnouncementIndexes,
  setNoteDraft,
  setIsTopBarOpen,
  setProspectName,
  setRepName,
}: {
  announcements: string[];
  hiddenAnnouncementIndexes: number[];
  noteDraft: string;
  notes: string[];
  isFront: boolean;
  isTopBarOpen: boolean;
  isAdmin: boolean;
  onOpenLogout: () => void;
  onOpenSettings: () => void;
  onAddNote: () => void;
  onDeleteNote: (index: number) => void;
  prospectName: string;
  repName: string;
  setActiveOverlay: React.Dispatch<React.SetStateAction<"top" | "team" | "bottom" | "objections">>;
  setHiddenAnnouncementIndexes: React.Dispatch<React.SetStateAction<number[]>>;
  setNoteDraft: React.Dispatch<React.SetStateAction<string>>;
  setIsTopBarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setProspectName: React.Dispatch<React.SetStateAction<string>>;
  setRepName: React.Dispatch<React.SetStateAction<string>>;
}) {
  const hasVisibleAnnouncements = announcements.some((_, index) => !hiddenAnnouncementIndexes.includes(index)) || notes.length > 0;
  const notesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!notesRef.current || notes.length === 0) return;
    notesRef.current.scrollTo({
      top: notesRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [notes.length]);

  return (
    <header
      className={`top-bar ${isTopBarOpen ? "is-open" : "is-collapsed"} ${isFront ? "is-front" : ""} ${hasVisibleAnnouncements ? "has-announcements" : "has-no-announcements"}`}
      aria-label="TeamTree toolbar"
    >
      <div className="top-bar-content">
        <div className="top-bar-row">
          <h1 className="top-bar-title"><img className="top-bar-logo" src={treeLogo} alt="TeamTree" /></h1>

          <div className="top-bar-names">
            <input
              aria-label="Prospect name"
              className="top-name-input"
              onChange={(event) => setProspectName(event.target.value)}
              placeholder="PP"
              type="text"
              value={prospectName}
            />
            <input
              aria-label="Rep name"
              className="top-name-input"
              onChange={(event) => setRepName(event.target.value)}
              placeholder="RR"
              type="text"
              value={repName}
            />
          </div>
          <div className="top-bar-actions">
            {isAdmin ? (
              <button aria-label="Open admin settings" className="account-link" onClick={onOpenSettings} type="button">
                <Icon name="settings" />
              </button>
            ) : null}
            <a
              aria-label="Log out"
              className="account-link"
              href="#logout"
              onClick={(event) => {
                event.preventDefault();
                onOpenLogout();
              }}
            >
              <Icon name="userRound" />
            </a>
          </div>
        </div>

        <div className="top-bar-notes" ref={notesRef} aria-live="polite">
          {announcements.map((announcement, index) =>
            hiddenAnnouncementIndexes.includes(index) ? null : (
              <div className="top-note" key={`announcement-${index}`}>
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
          {notes.map((note, index) => (
            <div className="top-note user-note" key={`note-${index}-${note}`}>
              <button aria-label="Delete note" className="top-note-dismiss" onClick={() => onDeleteNote(index)} type="button">
                <Icon name="x" />
              </button>
              <span>{note}</span>
            </div>
          ))}
        </div>

        <div className="top-note-composer">
          <input
            aria-label="New note"
            className="top-note-input"
            onChange={(event) => setNoteDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onAddNote();
              }
            }}
            placeholder=""
            type="text"
            value={noteDraft}
          />
          <button className="top-note-add" onClick={onAddNote} type="button">Add</button>
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



