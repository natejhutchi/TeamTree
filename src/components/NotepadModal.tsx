import { Icon } from "./Icon";

export function NotepadModal({
  addUserNote,
  closeNotepad,
  confirmDeleteNote,
  isNotepadClosing,
  isNotepadOpen,
  noteDraft,
  pendingNoteDeleteIndex,
  setNoteDraft,
  setPendingNoteDeleteIndex,
  userNotes,
}: {
  addUserNote: () => void;
  closeNotepad: () => void;
  confirmDeleteNote: () => void;
  isNotepadClosing: boolean;
  isNotepadOpen: boolean;
  noteDraft: string;
  pendingNoteDeleteIndex: number | null;
  setNoteDraft: React.Dispatch<React.SetStateAction<string>>;
  setPendingNoteDeleteIndex: React.Dispatch<React.SetStateAction<number | null>>;
  userNotes: string[];
}) {
  if (!isNotepadOpen && !isNotepadClosing) {
    return null;
  }

  return (
    <div className={`notepad-shell ${isNotepadClosing ? "is-closing" : ""}`} role="dialog" aria-modal="true" aria-label="Notes">
      <div className={`notepad-panel ${isNotepadClosing ? "is-closing" : ""}`}>
        <div className="notepad-header">
          <h2>Notes</h2>
          <button aria-label="Close notes" className="notepad-icon-button" onClick={closeNotepad} type="button">
            <Icon name="x" />
          </button>
        </div>

        <div className="notepad-notes">
          {userNotes.map((note, index) => (
            <div className="notepad-note" key={`${note}-${index}`}>
              <button aria-label="Delete note" className="top-note-dismiss" onClick={() => setPendingNoteDeleteIndex(index)} type="button">
                <Icon name="x" />
              </button>
              <span>{note}</span>
            </div>
          ))}
        </div>

        <div className="notepad-composer">
          <input
            aria-label="New note"
            onChange={(event) => setNoteDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                addUserNote();
              }
            }}
            placeholder="Add a note"
            type="text"
            value={noteDraft}
          />
          <button className="notepad-add" onClick={addUserNote} type="button">Add</button>
        </div>

        {pendingNoteDeleteIndex !== null ? (
          <div className="notepad-confirm" role="alertdialog" aria-label="Confirm note deletion">
            <p>Delete this note?</p>
            <div className="notepad-confirm-actions">
              <button onClick={() => setPendingNoteDeleteIndex(null)} type="button">Cancel</button>
              <button onClick={confirmDeleteNote} type="button">Delete</button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
