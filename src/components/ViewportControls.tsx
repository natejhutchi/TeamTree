import { Icon } from "./Icon";
import type { NavigateToBlock } from "./scriptRendering";

export function ViewportControls({
  canUndo,
  goToHistoryIndex,
  historyIndex,
  isEditMode,
  navigateToBlock,
  onToggleEditMode,
  onAddBlock,
  onUndoEdit,
  onZoomIn,
  onZoomOut,
  openNotepad,
  openTreeModal,
}: {
  canUndo: boolean;
  goToHistoryIndex: (nextIndex: number) => void;
  historyIndex: number;
  isEditMode: boolean;
  navigateToBlock: NavigateToBlock;
  onToggleEditMode: () => void;
  onAddBlock: () => void;
  onUndoEdit: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  openNotepad: () => void;
  openTreeModal: () => void;
}) {
  return (
    <>
      <div className="viewport-corner-controls" aria-label="Viewport controls">
        <button aria-label="Select opener" className="viewport-icon-button" onClick={() => navigateToBlock("start")} type="button">
          <Icon name="mousePointerBan" />
        </button>
        <button aria-label="Zoom out" className="viewport-icon-button" onClick={onZoomOut} type="button">
          <Icon name="zoomOut" />
        </button>
        <button aria-label="Zoom in" className="viewport-icon-button" onClick={onZoomIn} type="button">
          <Icon name="zoomIn" />
        </button>
      </div>

      <div className="viewport-history-controls" aria-label="Dialogue navigation controls">
        <button
          aria-label={isEditMode ? "Undo last edit" : "Undo block selection"}
          className="viewport-icon-button"
          disabled={!isEditMode && !canUndo}
          onClick={() => {
            if (isEditMode) {
              onUndoEdit();
              return;
            }

            goToHistoryIndex(historyIndex - 1);
          }}
          type="button"
        >
          <Icon name="undo" />
        </button>
      </div>

      <div className="viewport-bottom-left-controls" aria-label="Main and edit controls">
        <button aria-label="Open trees" className="viewport-icon-button viewport-tree-button" onClick={openTreeModal} type="button">
          <Icon name="treeDeciduous" />
        </button>
        <button aria-label={isEditMode ? "Exit edit mode" : "Edit dialogue text"} className={`viewport-icon-button viewport-edit-button ${isEditMode ? "is-active" : ""}`} onClick={onToggleEditMode} type="button">
          <Icon name="squarePen" />
        </button>
        {isEditMode ? (
          <button aria-label="Add block" className="viewport-icon-button viewport-add-block-button" onClick={onAddBlock} type="button">
            <Icon name="squarePlus" />
          </button>
        ) : null}
      </div>

      <button aria-label="Open notes" className="viewport-icon-button viewport-notebook-button" onClick={openNotepad} type="button">
        <Icon name="notebookPen" />
      </button>
    </>
  );
}



