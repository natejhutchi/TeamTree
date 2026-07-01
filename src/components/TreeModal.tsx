import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import type { StoredTree } from "./useTreeData";

export function TreeModal({
  closeTreeModal,
  copyTree,
  createBlankTree,
  deleteSelectedTree,
  downloadTreeBackup,
  isTreeModalClosing,
  isTreeModalOpen,
  renameSelectedTree,
  selectedTreeId,
  switchTree,
  treeError,
  trees,
}: {
  closeTreeModal: () => void;
  copyTree: (treeId?: string) => void;
  createBlankTree: () => void;
  deleteSelectedTree: (treeId?: string) => void;
  downloadTreeBackup: (treeId?: string) => void;
  isTreeModalClosing: boolean;
  isTreeModalOpen: boolean;
  renameSelectedTree: (nextName: string, treeId?: string) => boolean | Promise<boolean>;
  selectedTreeId: string;
  switchTree: (treeId: string) => void;
  treeError: string;
  trees: StoredTree[];
}) {
  const [treeNameDraft, setTreeNameDraft] = useState("");
  const [isRenamingTree, setIsRenamingTree] = useState(false);
  const [pendingDeleteTreeId, setPendingDeleteTreeId] = useState<string | null>(null);
  const treeNameInputRef = useRef<HTMLInputElement | null>(null);

  const selectedTree = trees.find((tree) => tree.id === selectedTreeId);
  const pendingDeleteTree = trees.find((tree) => tree.id === pendingDeleteTreeId);

  useEffect(() => {
    setTreeNameDraft(selectedTree?.name ?? "");
  }, [selectedTree?.name]);

  useEffect(() => {
    if (!isRenamingTree) return;
    treeNameInputRef.current?.focus();
    treeNameInputRef.current?.select();
  }, [isRenamingTree]);

  if (!isTreeModalOpen && !isTreeModalClosing) {
    return null;
  }

  const canEditSelectedTree = Boolean(selectedTree?.canEdit);
  function commitTreeName() {
    if (!selectedTree || !canEditSelectedTree) {
      setTreeNameDraft(selectedTree?.name ?? "");
      setIsRenamingTree(false);
      return;
    }

    const treeId = selectedTree.id;
    void Promise.resolve(renameSelectedTree(treeNameDraft, treeId)).then((didRename: boolean) => {
      if (!didRename) {
        setTreeNameDraft((currentDraft) => trees.find((tree) => tree.id === treeId)?.name ?? currentDraft);
      }
    });
    setIsRenamingTree(false);
  }

  function selectTree(treeId: string) {
    switchTree(treeId);
  }

  function focusTreeName(tree: StoredTree) {
    if (!tree.canEdit) {
      return;
    }

    switchTree(tree.id);
    setTreeNameDraft(tree.name);
    setIsRenamingTree(true);
  }

  function requestDeleteTree(tree: StoredTree) {
    if (!tree.canEdit) {
      return;
    }

    switchTree(tree.id);
    setPendingDeleteTreeId(tree.id);
  }

  function confirmDeleteTree() {
    if (!pendingDeleteTreeId) {
      return;
    }

    void deleteSelectedTree(pendingDeleteTreeId);
    setPendingDeleteTreeId(null);
  }

  return (
    <div className={`notepad-shell account-shell tree-shell ${isTreeModalClosing ? "is-closing" : ""}`} role="dialog" aria-modal="true" aria-label="Trees">
      <div className={`notepad-panel account-panel tree-panel ${isTreeModalClosing ? "is-closing" : ""}`}>
        <div className="notepad-header">
            <h2>Trees</h2>
          <div className="tree-header-actions">
            <button aria-label="Close tree switcher" className="notepad-icon-button" onClick={closeTreeModal} type="button">
              <Icon name="x" />
            </button>
          </div>
          </div>

          <div className="account-logged-out tree-modal-controls">
            <div className="tree-picker" role="listbox" aria-label="Select tree">
              {trees.map((tree) => {
                const isSelected = tree.id === selectedTreeId;
                return isRenamingTree && isSelected ? (
                  <div aria-selected={isSelected} className="tree-picker-option tree-picker-rename" key={tree.id} role="option">
                    <label className="tree-picker-main">
                      <span className="sr-only">Rename selected tree</span>
                      <input
                        aria-label="Rename selected tree"
                        className="tree-name-inline-editor"
                        maxLength={30}
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
                    </label>
                    <div className="tree-row-actions">
                      <button
                        aria-label="Save tree name"
                        className="tree-row-action"
                        onClick={() => void commitTreeName()}
                        onMouseDown={(event) => event.preventDefault()}
                        type="button"
                      >
                        <Icon name="check" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div aria-selected={isSelected} className="tree-picker-option" key={tree.id} role="option">
                    <button className="tree-picker-main" onClick={() => selectTree(tree.id)} type="button">
                      <span className="tree-picker-name">{tree.name}</span>
                      {tree.creatorName ? <span className="tree-picker-creator">by {tree.creatorName}</span> : null}
                    </button>
                    <div className="tree-row-actions">
                      <button aria-label={`Copy ${tree.name}`} className="tree-row-action" onClick={() => void copyTree(tree.id)} type="button">
                        <Icon name="copy" />
                      </button>
                      <button aria-label={`Rename ${tree.name}`} className="tree-row-action" disabled={!tree.canEdit} onClick={() => focusTreeName(tree)} type="button">
                        <Icon name="pencil" />
                      </button>
                      <button aria-label={`Delete ${tree.name}`} className="tree-row-action tree-row-delete" disabled={!tree.canEdit} onClick={() => requestDeleteTree(tree)} type="button">
                        <Icon name="trash2" />
                      </button>
                      <button aria-label={`Download ${tree.name}`} className="tree-row-action" onClick={() => void downloadTreeBackup(tree.id)} type="button">
                        <Icon name="download" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <button className="notepad-add" onClick={createBlankTree} type="button">
              Create Tree
            </button>
            <button className="tree-upload-placeholder" type="button">Upload</button>

          </div>

          {treeError ? <p className="account-error">{treeError}</p> : null}

          {pendingDeleteTree ? (
            <div className="notepad-confirm tree-delete-confirm" role="alertdialog" aria-modal="true" aria-label="Confirm tree deletion">
              <p>Delete {pendingDeleteTree.name}?</p>
              <div className="notepad-confirm-actions">
                <button onClick={() => setPendingDeleteTreeId(null)} type="button">Cancel</button>
                <button onClick={confirmDeleteTree} type="button">Delete</button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
  );
}







