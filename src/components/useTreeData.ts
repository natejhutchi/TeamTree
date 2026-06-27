import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import {
  DEFAULT_TREE_ID,
  createTreeId,
  loadHiddenAnnouncementMap,
  loadStoredData,
  saveHiddenAnnouncementMap,
  saveStoredData,
  type StoredTree,
} from "../storage";

export function useTreeData() {
  const [initialStoredData] = useState(loadStoredData);
  const [initialHiddenAnnouncements] = useState(loadHiddenAnnouncementMap);
  const [hiddenAnnouncementMap, setHiddenAnnouncementMap] = useState(initialHiddenAnnouncements);
  const [trees, setTrees] = useState<StoredTree[]>(initialStoredData.trees);
  const [archivedTrees, setArchivedTrees] = useState<StoredTree[]>(initialStoredData.archivedTrees);
  const [activeTreeId, setActiveTreeId] = useState(initialStoredData.activeTreeId);
  const [selectedTreeId, setSelectedTreeId] = useState<string>(initialStoredData.activeTreeId);
  const [treeError, setTreeError] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [pendingNoteDeleteIndex, setPendingNoteDeleteIndex] = useState<number | null>(null);

  const activeTree = trees.find((tree) => tree.id === activeTreeId) ?? trees[0];
  const treeNotes = activeTree?.notes ?? [];
  const hiddenAnnouncementIndexes = hiddenAnnouncementMap[activeTreeId] ?? [];
  const setHiddenAnnouncementIndexes: Dispatch<SetStateAction<number[]>> = (nextValue) => {
    setHiddenAnnouncementMap((currentMap) => {
      const currentIndexes = currentMap[activeTreeId] ?? [];
      const nextIndexes = typeof nextValue === "function" ? nextValue(currentIndexes) : nextValue;

      return { ...currentMap, [activeTreeId]: nextIndexes };
    });
  };

  function prepareTreeModal() {
    setSelectedTreeId(activeTreeId);
    setTreeError("");
  }

  function getNextTreeName(baseName: string, extraTrees: StoredTree[] = []) {
    const existingNames = new Set([...trees, ...archivedTrees, ...extraTrees].map((tree) => tree.name));

    if (!existingNames.has(baseName)) {
      return baseName;
    }

    let index = 2;
    while (existingNames.has(`${baseName} ${index}`)) {
      index += 1;
    }

    return `${baseName} ${index}`;
  }

  function switchTree(nextTreeId: string) {
    const selectedTree = trees.find((tree) => tree.id === nextTreeId);

    if (!selectedTree) {
      setTreeError("Select a tree first.");
      return;
    }

    setActiveTreeId(selectedTree.id);
    setSelectedTreeId(selectedTree.id);
    setPendingNoteDeleteIndex(null);
    setTreeError("");
  }

  function createBlankTree() {
    const newTree: StoredTree = {
      id: createTreeId(),
      name: getNextTreeName("New tree"),
      notes: [],
      tree: null,
    };

    setTrees((currentTrees) => [...currentTrees, newTree]);
    setActiveTreeId(newTree.id);
    setSelectedTreeId(newTree.id);
    setPendingNoteDeleteIndex(null);
    setTreeError("");
  }

  function copyTree() {
    if (!activeTree) {
      setTreeError("Select a tree first.");
      return;
    }

    const copiedTree: StoredTree = {
      id: createTreeId(),
      name: getNextTreeName(`${activeTree.name} copy`),
      notes: [...activeTree.notes],
      tree: activeTree.tree,
    };

    setTrees((currentTrees) => [...currentTrees, copiedTree]);
    setActiveTreeId(copiedTree.id);
    setSelectedTreeId(copiedTree.id);
    setPendingNoteDeleteIndex(null);
    setTreeError("");
  }

  function renameSelectedTree(nextName: string) {
    const selectedTree = trees.find((tree) => tree.id === selectedTreeId);
    const trimmedName = nextName.trim();

    if (!selectedTree || selectedTree.id === DEFAULT_TREE_ID) {
      setTreeError("The default tree cannot be renamed.");
      return false;
    }

    if (!trimmedName) {
      setTreeError("Tree name cannot be blank.");
      return false;
    }

    const duplicateName = [...trees, ...archivedTrees].some((tree) => tree.id !== selectedTree.id && tree.name === trimmedName);

    if (duplicateName) {
      setTreeError("That tree name is already in use.");
      return false;
    }

    setTrees((currentTrees) => currentTrees.map((tree) => (tree.id === selectedTree.id ? { ...tree, name: trimmedName } : tree)));
    setTreeError("");
    return true;
  }

  function deleteSelectedTree() {
    const selectedTree = trees.find((tree) => tree.id === selectedTreeId);

    if (!selectedTree || selectedTree.id === DEFAULT_TREE_ID) {
      setTreeError("The default tree cannot be deleted.");
      return;
    }

    setTrees((currentTrees) => currentTrees.filter((tree) => tree.id !== selectedTree.id));
    setArchivedTrees((currentArchivedTrees) => [...currentArchivedTrees.filter((tree) => tree.id !== selectedTree.id), selectedTree]);
    setActiveTreeId(DEFAULT_TREE_ID);
    setSelectedTreeId(DEFAULT_TREE_ID);
    setPendingNoteDeleteIndex(null);
    setTreeError("");
  }

  function restoreTree(treeId: string) {
    const archivedTree = archivedTrees.find((tree) => tree.id === treeId);

    if (!archivedTree) {
      setTreeError("Select an archived tree first.");
      return;
    }

    const restoredTree: StoredTree = trees.some((tree) => tree.name === archivedTree.name)
      ? { ...archivedTree, name: getNextTreeName(archivedTree.name, [archivedTree]) }
      : archivedTree;

    setArchivedTrees((currentArchivedTrees) => currentArchivedTrees.filter((tree) => tree.id !== archivedTree.id));
    setTrees((currentTrees) => [...currentTrees, restoredTree]);
    setActiveTreeId(restoredTree.id);
    setSelectedTreeId(restoredTree.id);
    setPendingNoteDeleteIndex(null);
    setTreeError("");
  }

  function addTreeNote() {
    const trimmedNote = noteDraft.trim();

    if (!trimmedNote) {
      return;
    }

    setTrees((currentTrees) =>
      currentTrees.map((tree) =>
        tree.id === activeTreeId ? { ...tree, notes: [...tree.notes, trimmedNote] } : tree,
      ),
    );
    setNoteDraft("");
  }

  function confirmDeleteNote() {
    if (pendingNoteDeleteIndex === null) {
      return;
    }

    setTrees((currentTrees) =>
      currentTrees.map((tree) =>
        tree.id === activeTreeId
          ? { ...tree, notes: tree.notes.filter((_, index) => index !== pendingNoteDeleteIndex) }
          : tree,
      ),
    );
    setPendingNoteDeleteIndex(null);
  }

  function logout(onLogout?: () => void) {
    onLogout?.();
  }

  useEffect(() => {
    saveStoredData({ trees, archivedTrees, activeTreeId });
  }, [trees, archivedTrees, activeTreeId]);

  useEffect(() => {
    saveHiddenAnnouncementMap(hiddenAnnouncementMap);
  }, [hiddenAnnouncementMap]);

  useEffect(() => {
    if (!trees.some((tree) => tree.id === activeTreeId)) {
      setActiveTreeId(DEFAULT_TREE_ID);
      setSelectedTreeId(DEFAULT_TREE_ID);
    }
  }, [trees, activeTreeId]);

  return {
    activeTree,
    activeTreeId,
    addTreeNote,
    archivedTrees,
    confirmDeleteNote,
    copyTree,
    createBlankTree,
    deleteSelectedTree,
    hiddenAnnouncementIndexes,
    logout,
    noteDraft,
    pendingNoteDeleteIndex,
    prepareTreeModal,
    renameSelectedTree,
    restoreTree,
    selectedTreeId,
    setHiddenAnnouncementIndexes,
    setNoteDraft,
    setPendingNoteDeleteIndex,
    switchTree,
    treeError,
    treeNotes,
    trees,
  };
}

