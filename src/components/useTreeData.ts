import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { supabase } from "../supabaseClient";
import type { TeamMembership } from "../auth/useTeamTownAuth";
import { emptyTreeData, normalizeTreeData, type TeamTreeData } from "../treeData";

export type StoredTree = {
  id: string;
  name: string;
  notes: string[];
  tree: TeamTreeData;
  isDefault?: boolean;
  archivedAt?: string | null;
  createdByUserId?: string | null;
  creatorName?: string;
  canEdit: boolean;
};

type TreeRow = {
  id: string;
  name: string;
  data: unknown;
  is_default: boolean;
  archived_at: string | null;
  created_by: string | null;
};

type MemberRow = {
  user_id: string | null;
  display_name: string | null;
};

export function useTreeData(membership: TeamMembership, profileName = "") {
  const [trees, setTrees] = useState<StoredTree[]>([]);
  const [archivedTrees, setArchivedTrees] = useState<StoredTree[]>([]);
  const [activeTreeId, setActiveTreeId] = useState("");
  const [selectedTreeId, setSelectedTreeId] = useState("");
  const [treeError, setTreeError] = useState("");
  const [isTreeLoading, setIsTreeLoading] = useState(true);
  const [noteDraft, setNoteDraft] = useState("");
  const [pendingNoteDeleteIndex, setPendingNoteDeleteIndex] = useState<number | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const lastSavedTreeDataRef = useRef<Record<string, string>>({});

  const activeTree = useMemo(() => trees.find((tree) => tree.id === activeTreeId) ?? trees[0], [trees, activeTreeId]);
  const treeNotes = activeTree?.notes ?? [];
  const hiddenAnnouncementIndexes = activeTree?.tree.hiddenAnnouncementIndexes ?? [];

  function snapshotTreeBeforeSave(treeId: string, previousData: TeamTreeData | undefined, nextData: TeamTreeData) {
    if (typeof window === "undefined") return;

    try {
      const key = "teamtree:save-snapshots";
      const existing = JSON.parse(window.localStorage.getItem(key) ?? "[]");
      const snapshots = Array.isArray(existing) ? existing : [];
      snapshots.push({
        treeId,
        savedAt: new Date().toISOString(),
        previousData: previousData ?? null,
        nextData,
      });
      window.localStorage.setItem(key, JSON.stringify(snapshots.slice(-30)));
    } catch {
      // Snapshotting is best-effort; never block the actual save path.
    }
  }

  function rowToStoredTree(row: TreeRow, creatorNamesByUserId: Map<string, string> = new Map()): StoredTree {
    const tree = normalizeTreeData(row.data);

    return {
      id: row.id,
      name: row.name,
      notes: tree.notes,
      tree,
      isDefault: row.is_default,
      archivedAt: row.archived_at,
      createdByUserId: row.created_by,
      creatorName: row.created_by === currentUserId ? (profileName || membership.display_name) : row.created_by ? creatorNamesByUserId.get(row.created_by) ?? "Unknown" : "TeamTown",
      canEdit: membership.member_role === "admin" || (!row.is_default && row.created_by === currentUserId),
    };
  }

  async function loadTrees() {
    if (!supabase || !membership.team_id) {
      setIsTreeLoading(false);
      return;
    }

    setIsTreeLoading(true);
    setTreeError("");

    const { data, error } = await supabase
      .from("trees")
      .select("id,name,data,is_default,archived_at,created_by")
      .eq("team_id", membership.team_id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });

    if (error) {
      setTreeError(error.message);
      setIsTreeLoading(false);
      return;
    }

    const creatorIds = Array.from(new Set(((data ?? []) as TreeRow[]).map((row) => row.created_by).filter(Boolean))) as string[];
    const { data: memberRows } = creatorIds.length > 0
      ? await supabase
        .from("team_members")
        .select("user_id,display_name")
        .eq("team_id", membership.team_id)
        .in("user_id", creatorIds)
      : { data: [] };
    const creatorNamesByUserId = new Map((memberRows ?? []).map((member) => [
      (member as MemberRow).user_id ?? "",
      (member as MemberRow).display_name || "Unknown",
    ]));
    const nextTrees = ((data ?? []) as TreeRow[]).map((row) => rowToStoredTree(row, creatorNamesByUserId));
    const activeTrees = nextTrees.filter((tree) => !tree.archivedAt);
    const nextArchivedTrees = nextTrees.filter((tree) => tree.archivedAt);
    const defaultTree = activeTrees.find((tree) => tree.isDefault) ?? activeTrees[0];

    setTrees(activeTrees);
    setArchivedTrees(nextArchivedTrees);
    setActiveTreeId((currentId) => activeTrees.some((tree) => tree.id === currentId) ? currentId : defaultTree?.id ?? "");
    setSelectedTreeId((currentId) => activeTrees.some((tree) => tree.id === currentId) ? currentId : defaultTree?.id ?? "");
    setIsTreeLoading(false);
  }

  async function saveTreeData(treeId: string, nextData: TeamTreeData): Promise<boolean> {
    if (!supabase || !treeId) return false;
    const targetTree = trees.find((tree) => tree.id === treeId);
    if (targetTree && !targetTree.canEdit) {
      setTreeError("You can only edit trees you own.");
      return false;
    }

    const serialized = JSON.stringify(nextData);
    if (lastSavedTreeDataRef.current[treeId] === serialized) return true;

    snapshotTreeBeforeSave(treeId, targetTree?.tree, nextData);

    setTrees((currentTrees) => currentTrees.map((tree) => (
      tree.id === treeId ? { ...tree, notes: nextData.notes, tree: nextData } : tree
    )));

    const { error } = await supabase
      .from("trees")
      .update({ data: nextData })
      .eq("id", treeId);

    if (error) {
      setTreeError(error.message);
      return false;
    }

    lastSavedTreeDataRef.current[treeId] = serialized;
    return true;
  }

  const setHiddenAnnouncementIndexes: Dispatch<SetStateAction<number[]>> = (nextValue) => {
    if (!activeTree) return;
    const currentIndexes = activeTree.tree.hiddenAnnouncementIndexes ?? [];
    const nextIndexes = typeof nextValue === "function" ? nextValue(currentIndexes) : nextValue;
    void saveTreeData(activeTree.id, { ...activeTree.tree, hiddenAnnouncementIndexes: nextIndexes });
  };

  function prepareTreeModal() {
    setSelectedTreeId(activeTreeId);
    setTreeError("");
  }

  function getNextTreeName(baseName: string, extraTrees: StoredTree[] = []) {
    const existingNames = new Set([...trees, ...extraTrees].map((tree) => tree.name));
    if (!existingNames.has(baseName)) return baseName;

    let index = 2;
    while (existingNames.has(`${baseName} ${index}`)) index += 1;
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

  async function createBlankTree() {
    if (!supabase) return;

    const nextName = getNextTreeName("New Tree");
    const nextData = { ...emptyTreeData(), hideDefaultBlocks: true, starterBlockId: "" };
    const { data, error } = await supabase
      .from("trees")
      .insert({
        team_id: membership.team_id,
        name: nextName,
        data: nextData,
        is_default: false,
      })
      .select("id,name,data,is_default,archived_at,created_by")
      .single();

    if (error) {
      setTreeError(error.message);
      return;
    }

    const newTree = rowToStoredTree(data as TreeRow);
    setTrees((currentTrees) => [...currentTrees, newTree]);
    setActiveTreeId(newTree.id);
    setSelectedTreeId(newTree.id);
    setPendingNoteDeleteIndex(null);
    setTreeError("");
  }

  async function copyTree(treeId = selectedTreeId) {
    const sourceTree = trees.find((tree) => tree.id === treeId);

    if (!supabase || !sourceTree) {
      setTreeError("Select a tree first.");
      return;
    }

    const nextName = getNextTreeName(`${sourceTree.name} copy`);
    const { data, error } = await supabase
      .from("trees")
      .insert({
        team_id: membership.team_id,
        name: nextName,
        data: sourceTree.tree,
        is_default: false,
      })
      .select("id,name,data,is_default,archived_at,created_by")
      .single();

    if (error) {
      setTreeError(error.message);
      return;
    }

    const copiedTree = rowToStoredTree(data as TreeRow);
    setTrees((currentTrees) => [...currentTrees, copiedTree]);
    setActiveTreeId(copiedTree.id);
    setSelectedTreeId(copiedTree.id);
    setPendingNoteDeleteIndex(null);
    setTreeError("");
  }

  async function renameSelectedTree(nextName: string, treeId = selectedTreeId) {
    const selectedTree = trees.find((tree) => tree.id === treeId);
    const trimmedName = nextName.trim();

    if (!selectedTree || !selectedTree.canEdit) {
      setTreeError(selectedTree?.isDefault ? "The default tree cannot be renamed." : "You can only rename trees you own.");
      return false;
    }

    if (!trimmedName) {
      setTreeError("Tree name cannot be blank.");
      return false;
    }

    const duplicateName = trees.some((tree) => tree.id !== selectedTree.id && tree.name === trimmedName);
    if (duplicateName) {
      setTreeError("That tree name is already in use.");
      return false;
    }

    setTrees((currentTrees) => currentTrees.map((tree) => tree.id === selectedTree.id ? { ...tree, name: trimmedName } : tree));
    const { error } = await supabase!.from("trees").update({ name: trimmedName }).eq("id", selectedTree.id);
    if (error) {
      setTreeError(error.message);
      void loadTrees();
      return false;
    }

    setTreeError("");
    return true;
  }

  async function deleteSelectedTree(treeId = selectedTreeId) {
    const selectedTree = trees.find((tree) => tree.id === treeId);

    if (!selectedTree || !selectedTree.canEdit) {
      setTreeError(selectedTree?.isDefault ? "The default tree cannot be deleted." : "You can only delete trees you own.");
      return;
    }

    const archivedAt = new Date().toISOString();
    setTrees((currentTrees) => currentTrees.filter((tree) => tree.id !== selectedTree.id));
    setArchivedTrees((currentArchivedTrees) => [...currentArchivedTrees.filter((tree) => tree.id !== selectedTree.id), { ...selectedTree, archivedAt }]);

    const fallbackTree = trees.find((tree) => tree.isDefault && tree.id !== selectedTree.id) ?? trees.find((tree) => tree.id !== selectedTree.id);
    setActiveTreeId(fallbackTree?.id ?? "");
    setSelectedTreeId(fallbackTree?.id ?? "");
    setPendingNoteDeleteIndex(null);
    setTreeError("");

    const { error } = await supabase!.from("trees").update({ archived_at: archivedAt }).eq("id", selectedTree.id);
    if (error) {
      setTreeError(error.message);
      void loadTrees();
    }
  }

  async function restoreTree(treeId: string) {
    const archivedTree = archivedTrees.find((tree) => tree.id === treeId);
    if (!archivedTree) {
      setTreeError("Select an archived tree first.");
      return;
    }

    if (!archivedTree.canEdit) {
      setTreeError("You can only restore trees you own.");
      return;
    }

    const restoredTree = trees.some((tree) => tree.name === archivedTree.name)
      ? { ...archivedTree, name: getNextTreeName(archivedTree.name, [archivedTree]), archivedAt: null }
      : { ...archivedTree, archivedAt: null };

    const { error } = await supabase!
      .from("trees")
      .update({ archived_at: null, name: restoredTree.name })
      .eq("id", archivedTree.id);

    if (error) {
      setTreeError(error.message);
      return;
    }

    setArchivedTrees((currentArchivedTrees) => currentArchivedTrees.filter((tree) => tree.id !== archivedTree.id));
    setTrees((currentTrees) => [...currentTrees, restoredTree]);
    setActiveTreeId(restoredTree.id);
    setSelectedTreeId(restoredTree.id);
    setPendingNoteDeleteIndex(null);
    setTreeError("");
  }


  function downloadTreeBackup(treeId = selectedTreeId) {
    const sourceTree = trees.find((tree) => tree.id === treeId);

    if (!sourceTree) {
      setTreeError("Select a tree first.");
      return;
    }

    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    const safeName = sourceTree.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "tree";
    const exportedAt = new Date().toISOString();
    const backup = {
      kind: "teamtree.tree.backup",
      version: 1,
      exportedAt,
      tree: {
        id: sourceTree.id,
        name: sourceTree.name,
        isDefault: Boolean(sourceTree.isDefault),
        createdByUserId: sourceTree.createdByUserId ?? null,
        creatorName: sourceTree.creatorName ?? "",
        data: sourceTree.tree,
      },
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeName}-${exportedAt.slice(0, 10)}.teamtree.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    setTreeError("");
  }

  function addTreeNote() {
    if (!activeTree) return;
    const trimmedNote = noteDraft.trim();
    if (!trimmedNote) return;

    void saveTreeData(activeTree.id, { ...activeTree.tree, notes: [...activeTree.tree.notes, trimmedNote] });
    setNoteDraft("");
  }


  function deleteTreeNote(indexToDelete: number) {
    if (!activeTree) return;
    void saveTreeData(activeTree.id, {
      ...activeTree.tree,
      notes: activeTree.tree.notes.filter((_, index) => index !== indexToDelete),
    });
    setPendingNoteDeleteIndex(null);
  }
  function confirmDeleteNote() {
    if (!activeTree || pendingNoteDeleteIndex === null) return;
    void saveTreeData(activeTree.id, {
      ...activeTree.tree,
      notes: activeTree.tree.notes.filter((_, index) => index !== pendingNoteDeleteIndex),
    });
    setPendingNoteDeleteIndex(null);
  }

  function logout(onLogout?: () => void) {
    onLogout?.();
  }

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    void loadTrees();
  }, [membership.team_id, currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;
    const creatorName = profileName || membership.display_name;
    setTrees((currentTrees) => currentTrees.map((tree) => tree.createdByUserId === currentUserId ? { ...tree, creatorName } : tree));
    setArchivedTrees((currentTrees) => currentTrees.map((tree) => tree.createdByUserId === currentUserId ? { ...tree, creatorName } : tree));
  }, [currentUserId, membership.display_name, profileName]);

  return {
    activeTree,
    activeTreeId,
    addTreeNote,
    archivedTrees,
    confirmDeleteNote,
    copyTree,
    createBlankTree,
    deleteSelectedTree,
    downloadTreeBackup,
    deleteTreeNote,
    hiddenAnnouncementIndexes,
    isTreeLoading,
    logout,
    noteDraft,
    pendingNoteDeleteIndex,
    prepareTreeModal,
    renameSelectedTree,
    restoreTree,
    saveTreeData,
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














