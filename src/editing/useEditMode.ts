import { useEffect, useMemo, useRef, useState, type Dispatch, type PointerEvent as ReactPointerEvent, type SetStateAction } from "react";
import { getCanvasScroller, getVisibleCanvasCenter, getWorldPoint, type CanvasTransform } from "../components/useCanvasViewport";
import type { DialogueBlock } from "../dialogueTree";
import { emptyTreeData, normalizeTreeData, type TeamTreeData, type TreeBlockOverrides, type TreePanels } from "../treeData";
import {
  createCustomBlock,
  createCustomOption,
  getAllBlockTitles,
  getAvailableSides as getAvailableSidesForBlock,
  getCustomOptionConflicts,
  resolveCustomOptions as resolveCustomOptionsForBlock,
} from "./editHelpers";
import type {
  BlockPositionMap,
  BlockZIndexMap,
  BlockSide,
  CustomOptionMap,
  EditAction,
  PendingEditDelete,
} from "./editTypes";

export function useEditMode({
  baseBlocks = [],
  initialTreeData,
  onTreeDataChange,
  setFlashingBlockId,
  setSelectedBlockId,
  treeDataKey,
  treeScale,
  viewportTransform,
}: {
  baseBlocks?: DialogueBlock[];
  initialTreeData?: TeamTreeData | null;
  onTreeDataChange?: (nextData: TeamTreeData) => boolean | void | Promise<boolean | void>;
  scrollToTextKey: (textKey: string) => void;
  setFlashingBlockId: Dispatch<SetStateAction<string | null>>;
  setSelectedBlockId: Dispatch<SetStateAction<string>>;
  treeDataKey?: string;
  treeScale: number;
  viewportTransform: CanvasTransform;
}) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSavingEditMode, setIsSavingEditMode] = useState(false);
  const [editSaveError, setEditSaveError] = useState("");
  const [deletedBlockIds, setDeletedBlockIds] = useState<Set<string>>(() => new Set());
  const [deletedButtonKeys] = useState<Set<string>>(() => new Set());
  const [pendingEditDelete, setPendingEditDelete] = useState<PendingEditDelete>(null);
  const [editHistory, setEditHistory] = useState<EditAction[]>([]);
  const [redoHistory, setRedoHistory] = useState<EditAction[]>([]);
  const [tiptapHistoryState, setTiptapHistoryState] = useState({ canUndo: false, canRedo: false });
  const [customBlocks, setCustomBlocks] = useState<DialogueBlock[]>([]);
  const [blockPositions, setBlockPositions] = useState<BlockPositionMap>({});
  const [blockZIndexes, setBlockZIndexes] = useState<BlockZIndexMap>({});
  const [absoluteBlockIds, setAbsoluteBlockIds] = useState<Set<string>>(() => new Set());
  const [customOptionsByBlock, setCustomOptionsByBlock] = useState<CustomOptionMap>({});
  const [blockOverrides, setBlockOverrides] = useState<TreeBlockOverrides>({});
  const [panels, setPanels] = useState<TreePanels>({});
  const [starterBlockId, setStarterBlockId] = useState("start");
  const lastSerializedTreeDataRef = useRef("");

  useEffect(() => {
    const serverTreeData = initialTreeData ?? emptyTreeData();
    const nextTreeData = serverTreeData;
    setDeletedBlockIds(new Set());
    setCustomBlocks(nextTreeData.blocks);
    const nextAbsoluteBlockIds = new Set(nextTreeData.absoluteBlockIds);
    nextTreeData.blocks.forEach((block) => {
      if (nextTreeData.blockPositions[block.id]) {
        nextAbsoluteBlockIds.add(block.id);
      }
    });

    setBlockPositions(nextTreeData.blockPositions);
    setBlockZIndexes(nextTreeData.blockZIndexes);
    setAbsoluteBlockIds(nextAbsoluteBlockIds);
    setCustomOptionsByBlock({});
    setBlockOverrides(nextTreeData.blockOverrides);
    setPanels(nextTreeData.panels);
    setStarterBlockId(nextTreeData.starterBlockId ?? "start");
    setEditHistory([]);
    setRedoHistory([]);
    setTiptapHistoryState({ canUndo: false, canRedo: false });
    setPendingEditDelete(null);
    setEditSaveError("");
    lastSerializedTreeDataRef.current = JSON.stringify(nextTreeData);
  }, [treeDataKey]);


  useEffect(() => {
    const handleTiptapHistoryState = (event: Event) => {
      const detail = (event as CustomEvent<{ canUndo?: boolean; canRedo?: boolean }>).detail;
      setTiptapHistoryState({
        canUndo: Boolean(detail?.canUndo),
        canRedo: Boolean(detail?.canRedo),
      });
    };

    window.addEventListener("teamtown:tiptap-history-state", handleTiptapHistoryState);
    return () => window.removeEventListener("teamtown:tiptap-history-state", handleTiptapHistoryState);
  }, []);
  const serializedEditTreeData = useMemo(() => JSON.stringify({
    ...(initialTreeData ?? emptyTreeData()),
    starterBlockId,
    blocks: customBlocks,
    blockPositions,
    blockZIndexes,
    absoluteBlockIds: [...absoluteBlockIds],
    blockOverrides,
    panels,
  } satisfies TeamTreeData), [
    absoluteBlockIds,
    blockOverrides,
    panels,
    blockPositions,
    blockZIndexes,
    customBlocks,
    deletedBlockIds,
    initialTreeData,
  ]);


  const allBlockTitles = getAllBlockTitles([...baseBlocks, ...customBlocks].map((block) => ({
    ...block,
    title: blockOverrides[block.id]?.title ?? block.title,
  })));
  const customOptionConflicts = getCustomOptionConflicts(customOptionsByBlock, allBlockTitles);


  function getNextCustomBlockTitle() {
    const existingTitles = new Set(Object.keys(allBlockTitles));

    if (!existingTitles.has("Title")) {
      return "Title";
    }

    let titleIndex = 2;
    while (existingTitles.has(`Title-${titleIndex}`)) {
      titleIndex += 1;
    }

    return `Title-${titleIndex}`;
  }

  async function toggleEditMode() {
    if (isSavingEditMode) return;
    setEditSaveError("");

    if (isEditMode) {
      if (treeDataKey && onTreeDataChange && lastSerializedTreeDataRef.current !== serializedEditTreeData) {
        const nextData = JSON.parse(serializedEditTreeData) as TeamTreeData;
        setIsSavingEditMode(true);

        try {
          const didSave = await Promise.resolve(onTreeDataChange(nextData));
          if (didSave === false) {
            setEditSaveError("Save failed. Check your connection. Contact support if this problem persists.");
            return;
          }

          lastSerializedTreeDataRef.current = serializedEditTreeData;
        } catch {
          setEditSaveError("Save failed. Check your connection. Contact support if this problem persists.");
          return;
        } finally {
          setIsSavingEditMode(false);
        }
      }

      setIsEditMode(false);
      return;
    }

    setIsEditMode(true);
  }

  function runEditorHistoryCommand(command: "undo" | "redo") {
    if (typeof window === "undefined") return false;

    const shouldFallback = window.dispatchEvent(new CustomEvent("teamtown:tiptap-command", {
      cancelable: true,
      detail: { command },
    }));

    if (!shouldFallback) {
      return true;
    }

    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement && activeElement.closest('[contenteditable="true"]')) {
      document.execCommand(command);
      return true;
    }

    return false;
  }

  function removeBlockForHistory(action: EditAction) {
    setCustomBlocks((currentBlocks) => currentBlocks.filter((block) => block.id !== action.id));
    setAbsoluteBlockIds((currentIds) => {
      const nextIds = new Set(currentIds);
      nextIds.delete(action.id);
      return nextIds;
    });
    setBlockPositions((currentPositions) => {
      const nextPositions = { ...currentPositions };
      delete nextPositions[action.id];
      return nextPositions;
    });
    setBlockOverrides((currentOverrides) => {
      const nextOverrides = { ...currentOverrides };
      delete nextOverrides[action.id];
      return nextOverrides;
    });
    setBlockZIndexes((currentIndexes) => {
      const nextIndexes = { ...currentIndexes };
      delete nextIndexes[action.id];
      return nextIndexes;
    });
  }

  function restoreBlockForHistory(action: EditAction) {
    if (action.type === "delete-block") {
      setDeletedBlockIds((currentIds) => {
        const nextIds = new Set(currentIds);
        nextIds.delete(action.id);
        return nextIds;
      });
    }

    if (action.customBlock) {
      setCustomBlocks((currentBlocks) => currentBlocks.some((block) => block.id === action.customBlock?.id)
        ? currentBlocks
        : [...currentBlocks, action.customBlock as DialogueBlock]);
    }

    if (action.position) {
      setBlockPositions((currentPositions) => ({ ...currentPositions, [action.id]: action.position as { x: number; y: number } }));
    }

    if (action.zIndex !== undefined) {
      setBlockZIndexes((currentIndexes) => ({ ...currentIndexes, [action.id]: action.zIndex as number }));
    }

    if (action.override) {
      const override = action.override;
      setBlockOverrides((currentOverrides) => ({ ...currentOverrides, [action.id]: override }));
    }

    if (action.wasAbsolute) {
      setAbsoluteBlockIds((currentIds) => new Set(currentIds).add(action.id));
    }
  }

  function redoBlockDelete(action: EditAction) {
    setDeletedBlockIds((currentIds) => new Set(currentIds).add(action.id));
    removeBlockForHistory(action);
  }

  function undoEdit() {
    if (runEditorHistoryCommand("undo")) {
      return;
    }

    const lastAction = editHistory.at(-1);

    if (!lastAction) {
      return;
    }

    setEditHistory((currentHistory) => currentHistory.slice(0, -1));
    setRedoHistory((currentHistory) => [...currentHistory, lastAction]);

    if (lastAction.type === "delete-block") {
      restoreBlockForHistory(lastAction);
      return;
    }

    removeBlockForHistory(lastAction);
  }

  function redoEdit() {
    if (runEditorHistoryCommand("redo")) {
      return;
    }

    const nextAction = redoHistory.at(-1);

    if (!nextAction) {
      return;
    }

    setRedoHistory((currentHistory) => currentHistory.slice(0, -1));
    setEditHistory((currentHistory) => [...currentHistory, nextAction]);

    if (nextAction.type === "delete-block") {
      redoBlockDelete(nextAction);
      return;
    }

    restoreBlockForHistory(nextAction);
  }
  function startMoveBlock(blockId: string, event: ReactPointerEvent<HTMLElement>) {
    const target = event.target instanceof HTMLElement ? event.target : null;

    if (target?.closest('[contenteditable="true"], input, textarea')) {
      return;
    }

    event.stopPropagation();

    const startX = event.clientX;
    const startY = event.clientY;
    const startPosition = blockPositions[blockId] ?? { x: 0, y: 0 };
    const dragThreshold = 4;
    let isMoving = false;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      if (!isMoving && Math.hypot(deltaX, deltaY) < dragThreshold) {
        return;
      }

      if (!isMoving) {
        isMoving = true;
        document.body.classList.add("is-moving-block");
        document.getElementById(blockId)?.classList.add("is-being-dragged");
        setBlockZIndexes((currentIndexes) => ({
          ...currentIndexes,
          [blockId]: Math.max(15, ...Object.values(currentIndexes)) + 1,
        }));
      }

      moveEvent.preventDefault();
      setBlockPositions((currentPositions) => ({
        ...currentPositions,
        [blockId]: {
          x: startPosition.x + deltaX / treeScale,
          y: startPosition.y + deltaY / treeScale,
        },
      }));
    };

    const stopMoving = () => {
      document.body.classList.remove("is-moving-block");
      document.getElementById(blockId)?.classList.remove("is-being-dragged");
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopMoving);
      window.removeEventListener("pointercancel", stopMoving);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", stopMoving);
    window.addEventListener("pointercancel", stopMoving);
  }

  function getStockBlockPosition() {
    const scroller = getCanvasScroller();
    const scrollerRect = scroller?.getBoundingClientRect();
    const blockWidth = 640;
    const blockHeight = 180;

    if (!scrollerRect) {
      return { x: 0, y: 0 };
    }

    const visibleCenter = getVisibleCanvasCenter(scrollerRect);
    const worldCenter = getWorldPoint(visibleCenter.x, visibleCenter.y, viewportTransform);

    return {
      x: worldCenter.x - blockWidth / 2,
      y: worldCenter.y - blockHeight / 2,
    };
  }

  function addCustomBlock() {
    const id = `custom-${Date.now()}`;
    const newBlock = createCustomBlock(id, getNextCustomBlockTitle());
    const position = getStockBlockPosition();
    const zIndex = Math.max(15, ...Object.values(blockZIndexes)) + 1;

    setCustomBlocks((currentBlocks) => [...currentBlocks, newBlock]);
    setAbsoluteBlockIds((currentIds) => new Set(currentIds).add(id));
    setBlockPositions((currentPositions) => ({ ...currentPositions, [id]: position }));
    setBlockZIndexes((currentIndexes) => ({ ...currentIndexes, [id]: zIndex }));
    setSelectedBlockId(id);
    setFlashingBlockId(null);
    setRedoHistory([]);
    setEditHistory((currentHistory) => [...currentHistory, { type: "add-block", id, customBlock: newBlock, position, zIndex, wasAbsolute: true }]);
  }
  function addAdjacentBlock(sourceBlockId: string, side: BlockSide) {
    const source = document.getElementById(sourceBlockId);
    const board = document.querySelector<HTMLElement>(".tree-board");

    if (!source || !board) {
      addCustomBlock();
      return;
    }

    const id = `custom-${Date.now()}`;
    const newBlock = createCustomBlock(id, getNextCustomBlockTitle());
    const sourceRect = source.getBoundingClientRect();
    const boardRect = board.getBoundingClientRect();
    const gap = 28;
    const smallWidth = 260;
    const smallHeight = 130;
    const sourceX = (sourceRect.left - boardRect.left) / treeScale;
    const sourceY = (sourceRect.top - boardRect.top) / treeScale;
    const sourceWidth = sourceRect.width / treeScale;
    const sourceHeight = sourceRect.height / treeScale;
    const position = (() => {
      if (side === "left") {
        return { x: sourceX - smallWidth - gap, y: sourceY };
      }

      if (side === "right") {
        return { x: sourceX + sourceWidth + gap, y: sourceY };
      }

      if (side === "top") {
        return { x: sourceX, y: sourceY - smallHeight - gap };
      }

      return { x: sourceX, y: sourceY + sourceHeight + gap };
    })();
    const zIndex = Math.max(15, ...Object.values(blockZIndexes)) + 1;

    setCustomBlocks((currentBlocks) => [...currentBlocks, newBlock]);
    setAbsoluteBlockIds((currentIds) => new Set(currentIds).add(id));
    setBlockPositions((currentPositions) => ({ ...currentPositions, [id]: position }));
    setBlockZIndexes((currentIndexes) => ({ ...currentIndexes, [id]: zIndex }));
    setSelectedBlockId(id);
    setFlashingBlockId(null);
    setRedoHistory([]);
    setEditHistory((currentHistory) => [...currentHistory, { type: "add-block", id, customBlock: newBlock, position, zIndex, wasAbsolute: true }]);
  }
  function requestDeleteBlock(blockId: string) {
    const block = baseBlocks.find((item) => item.id === blockId) ?? customBlocks.find((item) => item.id === blockId);
    const title = blockOverrides[blockId]?.title ?? block?.title;
    setPendingEditDelete({ type: "block", id: blockId, label: title ?? "block" });
  }

  function addCustomOption(blockId: string) {
    const option = createCustomOption();
    setCustomOptionsByBlock((currentOptions) => ({
      ...currentOptions,
      [blockId]: [...(currentOptions[blockId] ?? []), option],
    }));
  }

  function updateCustomOption(blockId: string, optionId: string, label: string) {
    setCustomOptionsByBlock((currentOptions) => ({
      ...currentOptions,
      [blockId]: (currentOptions[blockId] ?? []).map((option) => (
        option.id === optionId ? { ...option, label } : option
      )),
    }));
  }

  function updateBlockOverride(blockId: string, override: { title?: string; bodyHtml?: string; highlightIndex?: number }) {
    setBlockOverrides((currentOverrides) => ({
      ...currentOverrides,
      [blockId]: {
        ...(currentOverrides[blockId] ?? {}),
        ...override,
      },
    }));
  }
  function updatePanel(panel: keyof TreePanels, key: string, html: string) {
    setPanels((currentPanels) => {
      if (panel === "bottomClientsHtml") {
        return { ...currentPanels, bottomClientsHtml: html };
      }

      const currentPanel = currentPanels[panel] as Record<string, string> | undefined;

      return {
        ...currentPanels,
        [panel]: {
          ...(currentPanel ?? {}),
          [key]: html,
        },
      };
    });
  }

  function setStarterBlock(blockId: string) {
    setStarterBlockId(blockId);
  }

  function confirmEditDelete() {
    if (!pendingEditDelete) {
      return;
    }

    const customBlock = customBlocks.find((block) => block.id === pendingEditDelete.id);
    const position = blockPositions[pendingEditDelete.id];
    const zIndex = blockZIndexes[pendingEditDelete.id];
    const override = blockOverrides[pendingEditDelete.id];
    const wasAbsolute = absoluteBlockIds.has(pendingEditDelete.id);
    setRedoHistory([]);
    setEditHistory((currentHistory) => [...currentHistory, { type: "delete-block", id: pendingEditDelete.id, customBlock, position, zIndex, override, wasAbsolute }]);
    setDeletedBlockIds((currentIds) => new Set(currentIds).add(pendingEditDelete.id));
    setCustomBlocks((currentBlocks) => currentBlocks.filter((block) => block.id !== pendingEditDelete.id));
    setAbsoluteBlockIds((currentIds) => {
      const nextIds = new Set(currentIds);
      nextIds.delete(pendingEditDelete.id);
      return nextIds;
    });
    setBlockPositions((currentPositions) => {
      const nextPositions = { ...currentPositions };
      delete nextPositions[pendingEditDelete.id];
      return nextPositions;
    });
    setBlockZIndexes((currentIndexes) => {
      const nextIndexes = { ...currentIndexes };
      delete nextIndexes[pendingEditDelete.id];
      return nextIndexes;
    });
    setBlockOverrides((currentOverrides) => {
      const nextOverrides = { ...currentOverrides };
      delete nextOverrides[pendingEditDelete.id];
      return nextOverrides;
    });
    setPendingEditDelete(null);
  }
  const getAvailableSides = (block: DialogueBlock) => getAvailableSidesForBlock(block, absoluteBlockIds);
  const resolveCustomOptions = (blockId: string) => resolveCustomOptionsForBlock(blockId, customOptionsByBlock, allBlockTitles);

  return {
    absoluteBlockIds,
    addAdjacentBlock,
    addCustomBlock,
    addCustomOption,
    blockOverrides,
    panels,
    blockPositions,
    blockZIndexes,
    confirmEditDelete,
    customBlocks,
    customOptionConflicts,
    deletedBlockIds,
    deletedButtonKeys,
    editHistory,
    canUndoEdit: editHistory.length > 0 || tiptapHistoryState.canUndo,
    canRedoEdit: redoHistory.length > 0 || tiptapHistoryState.canRedo,
    redoHistory,
    getAvailableSides,
    isEditMode,
    isSavingEditMode,
    editSaveError,
    pendingEditDelete,
    requestDeleteBlock,
    redoEdit,
    resolveCustomOptions,
    setIsEditMode,
    setPendingEditDelete,
    setStarterBlock,
    starterBlockId,
    startMoveBlock,
    toggleEditMode,
    undoEdit,
    updateBlockOverride,
    updatePanel,
    updateCustomOption,
  };
}




















































