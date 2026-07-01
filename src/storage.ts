export type StoredTree = {
  id: string;
  name: string;
  notes: string[];
  tree: null;
};

export type StoredData = {
  trees: StoredTree[];
  archivedTrees: StoredTree[];
  activeTreeId: string;
};

export const STORAGE_KEY = "teamtree:data";
export const DEFAULT_TREE_ID = "teamtown-default-tree";
export const DEFAULT_TREE_NAME = "TeamTown";
export const ANNOUNCEMENT_STORAGE_KEY = "teamtree:hidden-announcements";

export type HiddenAnnouncementMap = Record<string, number[]>;

function createDefaultTree(): StoredTree {
  return {
    id: DEFAULT_TREE_ID,
    name: DEFAULT_TREE_NAME,
    notes: [],
    tree: null,
  };
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => Number.isInteger(item) && item >= 0);
}

export function loadHiddenAnnouncementMap(): HiddenAnnouncementMap {
  try {
    const rawData = window.localStorage.getItem(ANNOUNCEMENT_STORAGE_KEY);

    if (!rawData) {
      return {};
    }

    const parsedData = JSON.parse(rawData) as Record<string, unknown>;

    return Object.fromEntries(
      Object.entries(parsedData).filter((entry): entry is [string, number[]] => typeof entry[0] === "string" && isNumberArray(entry[1])),
    );
  } catch {
    return {};
  }
}

export function saveHiddenAnnouncementMap(data: HiddenAnnouncementMap) {
  window.localStorage.setItem(ANNOUNCEMENT_STORAGE_KEY, JSON.stringify(data));
}

function isStoredTree(value: unknown): value is StoredTree {
  const tree = value as StoredTree;

  return (
    typeof tree?.id === "string" &&
    typeof tree.name === "string" &&
    Array.isArray(tree.notes)
  );
}

function normalizeTrees(trees: StoredTree[]) {
  const defaultTree = createDefaultTree();
  const treeMap = new Map<string, StoredTree>();

  treeMap.set(defaultTree.id, defaultTree);
  trees.forEach((tree) => treeMap.set(tree.id, { ...tree, tree: null }));

  return Array.from(treeMap.values());
}

function normalizeArchivedTrees(trees: StoredTree[]) {
  const treeMap = new Map<string, StoredTree>();

  trees
    .filter((tree) => tree.id !== DEFAULT_TREE_ID)
    .forEach((tree) => treeMap.set(tree.id, { ...tree, tree: null }));

  return Array.from(treeMap.values());
}

export function loadStoredData(): StoredData {
  try {
    const rawData = window.localStorage.getItem(STORAGE_KEY);

    if (!rawData) {
      return { trees: [createDefaultTree()], archivedTrees: [], activeTreeId: DEFAULT_TREE_ID };
    }

    const parsedData = JSON.parse(rawData) as Partial<StoredData> & { users?: unknown[]; activeUserId?: unknown };
    const parsedTrees = Array.isArray(parsedData.trees) ? parsedData.trees.filter(isStoredTree) : [];
    const parsedArchivedTrees = Array.isArray(parsedData.archivedTrees) ? parsedData.archivedTrees.filter(isStoredTree) : [];
    const migratedUserTrees = Array.isArray(parsedData.users)
      ? parsedData.users
          .filter((user): user is { id: string; name: string; notes?: unknown[] } => {
            const candidate = user as { id?: unknown; name?: unknown; notes?: unknown };
            return typeof candidate.id === "string" && typeof candidate.name === "string";
          })
          .map((user) => ({
            id: `tree-${user.id}`,
            name: user.name,
            notes: Array.isArray(user.notes) ? user.notes.filter((note): note is string => typeof note === "string") : [],
            tree: null,
          }))
      : [];
    const trees = normalizeTrees([...parsedTrees, ...migratedUserTrees]);
    const archivedTrees = normalizeArchivedTrees(parsedArchivedTrees).filter((archivedTree) => !trees.some((tree) => tree.id === archivedTree.id));
    const activeTreeId =
      typeof parsedData.activeTreeId === "string" && trees.some((tree) => tree.id === parsedData.activeTreeId)
        ? parsedData.activeTreeId
        : DEFAULT_TREE_ID;

    return { trees, archivedTrees, activeTreeId };
  } catch {
    return { trees: [createDefaultTree()], archivedTrees: [], activeTreeId: DEFAULT_TREE_ID };
  }
}

export function saveStoredData(data: StoredData) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function createTreeId() {
  return `tree-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
