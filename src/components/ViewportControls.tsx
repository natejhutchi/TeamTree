import { Icon } from "./Icon";
import type { NavigateToBlock } from "./scriptRendering";

export function ViewportControls({
  canUndo,
  canRedo,
  goToHistoryIndex,
  historyIndex,
  isEditMode,
  navigateToBlock,
  starterBlockId,
  onToggleEditMode,
  canEditActiveTree,
  onAddBlock,
  onUndoEdit,
  onRedoEdit,
  openTreeModal,
}: {
  canUndo: boolean;
  canRedo: boolean;
  goToHistoryIndex: (nextIndex: number) => void;
  historyIndex: number;
  isEditMode: boolean;
  navigateToBlock: NavigateToBlock;
  starterBlockId: string;
  onToggleEditMode: () => void;
  canEditActiveTree: boolean;
  onAddBlock: () => void;
  onUndoEdit: () => void;
  onRedoEdit: () => void;
  openTreeModal: () => void;
}) {

  return (
    <>
      <div className="viewport-corner-controls" aria-label="Viewport controls">
        <button aria-label="Select opener" className="viewport-icon-button" onClick={() => navigateToBlock(starterBlockId)} type="button">
          <Icon name="mousePointerBan" />
        </button>
      </div>

      <div className="viewport-history-controls" aria-label="Dialogue navigation controls">
        <button
          aria-label={isEditMode ? "Undo last edit" : "Undo block selection"}
          className="viewport-icon-button"
          disabled={!canUndo}
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
        {isEditMode ? (
          <button aria-label="Redo last edit" className="viewport-icon-button" disabled={!canRedo} onClick={onRedoEdit} type="button">
            <Icon name="redo" />
          </button>
        ) : null}
      </div>

      <div className="viewport-bottom-left-controls" aria-label="Tree controls">
        <button aria-label="Open trees" className="viewport-icon-button viewport-tree-button" onClick={openTreeModal} type="button">
          <Icon name="treeDeciduous" />
        </button>
      </div>

      <div className="viewport-bottom-right-controls" aria-label="Edit controls">
        {isEditMode ? (
          <button
            aria-label="Add block"
            className="viewport-icon-button viewport-add-block-button"
            onClick={onAddBlock}
            type="button"
          >
            <Icon name="squarePlus" />
          </button>
        ) : null}
        <button aria-label={isEditMode ? "Exit edit mode" : "Edit dialogue text"} className={`viewport-icon-button viewport-edit-button ${isEditMode ? "is-active" : ""}`} disabled={!canEditActiveTree && !isEditMode} onClick={onToggleEditMode} type="button">
          <Icon name="squarePen" />
        </button>
      </div>
    </>
  );
}




