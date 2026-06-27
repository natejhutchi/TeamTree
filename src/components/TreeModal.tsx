import { useEffect, useRef, useState } from "react";
import { DEFAULT_TREE_ID, DEFAULT_TREE_NAME, type StoredTree } from "../storage";
import { Icon } from "./Icon";

export function TreeModal({
  archivedTrees,
  closeTreeModal,
  copyTree,
  createBlankTree,
  deleteSelectedTree,
  isTreeModalClosing,
  isTreeModalOpen,
  renameSelectedTree,
  restoreTree,
  selectedTreeId,
  switchTree,
  treeError,
  trees,
}: {
  archivedTrees: StoredTree[];
  closeTreeModal: () => void;
  copyTree: () => void;
  createBlankTree: () => void;
  deleteSelectedTree: () => void;
  isTreeModalClosing: boolean;
  isTreeModalOpen: boolean;
  renameSelectedTree: (nextName: string) => boolean;
  restoreTree: (treeId: string) => void;
  selectedTreeId: string;
  switchTree: (treeId: string) => void;
  treeError: string;
  trees: StoredTree[];
}) {
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [selectedArchivedTreeId, setSelectedArchivedTreeId] = useState("");
  const [treeNameDraft, setTreeNameDraft] = useState("");
  const treeNameInputRef = useRef<HTMLInputElement | null>(null);

  const selectedTree = trees.find((tree) => tree.id === selectedTreeId);

  useEffect(() => {
    setTreeNameDraft(selectedTree?.name ?? "");
  }, [selectedTree?.name]);

  if (!isTreeModalOpen && !isTreeModalClosing) {
    return null;
  }

  const customTrees = trees.filter((tree) => tree.id !== DEFAULT_TREE_ID);
  const canEditSelectedTree = selectedTreeId !== DEFAULT_TREE_ID;
  const selectedArchiveValue = selectedArchivedTreeId || archivedTrees[0]?.id || "";

  function openArchive() {
    setSelectedArchivedTreeId(archivedTrees[0]?.id ?? "");
    setIsArchiveOpen(true);
  }

  function restoreSelectedTree() {
    if (!selectedArchiveValue) {
      return;
    }

    restoreTree(selectedArchiveValue);
    setSelectedArchivedTreeId("");
  }

  function commitTreeName() {
    if (!canEditSelectedTree) {
      setTreeNameDraft(selectedTree?.name ?? DEFAULT_TREE_NAME);
      return;
    }

    if (!renameSelectedTree(treeNameDraft)) {
      setTreeNameDraft(selectedTree?.name ?? "");
    }
  }

  function focusTreeName() {
    if (!canEditSelectedTree) {
      return;
    }

    treeNameInputRef.current?.focus();
    treeNameInputRef.current?.select();
  }

  return (
    <>
      <div className={`notepad-shell account-shell tree-shell ${isTreeModalClosing ? "is-closing" : ""}`} role="dialog" aria-modal="true" aria-label="Trees">
        <div className={`notepad-panel account-panel tree-panel ${isArchiveOpen ? "is-disabled-behind-archive" : ""} ${isTreeModalClosing ? "is-closing" : ""}`} aria-hidden={isArchiveOpen}>
          <div className={`notepad-header ${isArchiveOpen ? "is-muted-by-archive" : ""}`}>
            <h2>Trees</h2>
            <div className="tree-header-actions">
              <button aria-label="Open archived trees" className="notepad-icon-button" disabled={isArchiveOpen} onClick={openArchive} type="button">
                <Icon name="archive" />
              </button>
              <button aria-label="Close tree switcher" className="notepad-icon-button" disabled={isArchiveOpen} onClick={closeTreeModal} type="button">
                <Icon name="x" />
              </button>
            </div>
          </div>

          <div className="account-logged-out tree-modal-controls">
            <label className="tree-select-shell">
              <span className="sr-only">Select tree</span>
              <select
                aria-label="Select tree"
                disabled={isArchiveOpen}
                onChange={(event) => switchTree(event.target.value)}
                value={selectedTreeId}
              >
                <option value={DEFAULT_TREE_ID}>{DEFAULT_TREE_NAME}</option>
                {customTrees.map((tree) => (
                  <option key={tree.id} value={tree.id}>{tree.name}</option>
                ))}
              </select>
              <span className="tree-select-chevron" aria-hidden="true"><Icon name="chevronDown" /></span>
            </label>

            <input
              aria-label="Rename selected tree"
              className="tree-name-editor"
              disabled={isArchiveOpen || !canEditSelectedTree}
              onBlur={commitTreeName}
              onChange={(event) => setTreeNameDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                }
              }}
              ref={treeNameInputRef}
              value={treeNameDraft}
            />

            <button className="notepad-add" disabled={isArchiveOpen} onClick={createBlankTree} type="button">
              Create Tree
            </button>

            <div className="tree-text-actions">
              <button className="account-mode-button" disabled={isArchiveOpen} onClick={copyTree} type="button">
                Copy Tree
              </button>
              <button className="account-mode-button" disabled={isArchiveOpen || !canEditSelectedTree} onClick={focusTreeName} type="button">
                Rename Tree
              </button>
              <button className="account-mode-button tree-delete-text" disabled={isArchiveOpen || !canEditSelectedTree} onClick={deleteSelectedTree} type="button">
                Delete Tree
              </button>
            </div>
          </div>

          {treeError ? <p className="account-error">{treeError}</p> : null}
        </div>
      </div>

      {isArchiveOpen ? (
        <div className="notepad-shell account-shell tree-archive-shell" role="dialog" aria-modal="true" aria-label="Archived trees">
          <div className="notepad-panel account-panel tree-archive-panel">
            <div className="notepad-header">
              <h2>Archive</h2>
              <button aria-label="Close archived trees" className="notepad-icon-button" onClick={() => setIsArchiveOpen(false)} type="button">
                <Icon name="x" />
              </button>
            </div>

            <div className="account-logged-out tree-modal-controls">
              <label className="tree-select-shell">
                <span className="sr-only">Select archived tree</span>
                <select
                  aria-label="Select archived tree"
                  disabled={archivedTrees.length === 0}
                  onChange={(event) => setSelectedArchivedTreeId(event.target.value)}
                  value={selectedArchiveValue}
                >
                  {archivedTrees.length === 0 ? <option value="">No archived trees</option> : null}
                  {archivedTrees.map((tree) => (
                    <option key={tree.id} value={tree.id}>{tree.name}</option>
                  ))}
                </select>
                <span className="tree-select-chevron" aria-hidden="true"><Icon name="chevronDown" /></span>
              </label>

              <button className="notepad-add" disabled={!selectedArchiveValue} onClick={restoreSelectedTree} type="button">
                Restore Tree
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}


