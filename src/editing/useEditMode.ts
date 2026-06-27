import { useState, type Dispatch, type PointerEvent as ReactPointerEvent, type SetStateAction } from "react";
import { type DialogueBlock, dialogueBlocks } from "../dialogueTree";
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
  BlockSide,
  CustomOptionMap,
  EditAction,
  PendingEditDelete,
} from "./editTypes";

export function useEditMode({
  setFlashingBlockId,
  setSelectedBlockId,
  treeScale,
}: {
  scrollToTextKey: (textKey: string) => void;
  setFlashingBlockId: Dispatch<SetStateAction<string | null>>;
  setSelectedBlockId: Dispatch<SetStateAction<string>>;
  treeScale: number;
}) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [deletedBlockIds, setDeletedBlockIds] = useState<Set<string>>(() => new Set());
  const [deletedButtonKeys] = useState<Set<string>>(() => new Set());
  const [pendingEditDelete, setPendingEditDelete] = useState<PendingEditDelete>(null);
  const [editHistory, setEditHistory] = useState<EditAction[]>([]);
  const [customBlocks, setCustomBlocks] = useState<DialogueBlock[]>([]);
  const [blockPositions, setBlockPositions] = useState<BlockPositionMap>({});
  const [absoluteBlockIds, setAbsoluteBlockIds] = useState<Set<string>>(() => new Set());
  const [customOptionsByBlock, setCustomOptionsByBlock] = useState<CustomOptionMap>({});

  const allBlockTitles = getAllBlockTitles([...dialogueBlocks, ...customBlocks]);
  const customOptionConflicts = getCustomOptionConflicts(customOptionsByBlock, allBlockTitles);

  function toggleEditMode() {
    setIsEditMode((isEditing) => !isEditing);
  }

  function undoEdit() {
    const lastAction = editHistory.at(-1);

    if (!lastAction) {
      document.execCommand("undo");
      return;
    }

    setEditHistory((currentHistory) => currentHistory.slice(0, -1));

    if (lastAction.type === "delete-block") {
      setDeletedBlockIds((currentIds) => {
        const nextIds = new Set(currentIds);
        nextIds.delete(lastAction.id);
        return nextIds;
      });

      if (lastAction.customBlock) {
        setCustomBlocks((currentBlocks) => [...currentBlocks, lastAction.customBlock as DialogueBlock]);
      }
      return;
    }

    setCustomBlocks((currentBlocks) => currentBlocks.filter((block) => block.id !== lastAction.id));
    setAbsoluteBlockIds((currentIds) => {
      const nextIds = new Set(currentIds);
      nextIds.delete(lastAction.id);
      return nextIds;
    });
    setBlockPositions((currentPositions) => {
      const nextPositions = { ...currentPositions };
      delete nextPositions[lastAction.id];
      return nextPositions;
    });
  }

  function startMoveBlock(blockId: string, event: ReactPointerEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startY = event.clientY;
    const startPosition = blockPositions[blockId] ?? { x: 0, y: 0 };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = (moveEvent.clientX - startX) / treeScale;
      const deltaY = (moveEvent.clientY - startY) / treeScale;
      setBlockPositions((currentPositions) => ({
        ...currentPositions,
        [blockId]: {
          x: startPosition.x + deltaX,
          y: startPosition.y + deltaY,
        },
      }));
    };

    const stopMoving = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopMoving);
      window.removeEventListener("pointercancel", stopMoving);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopMoving);
    window.addEventListener("pointercancel", stopMoving);
  }

  function getStockBlockPosition() {
    const board = document.querySelector<HTMLElement>(".tree-board");
    const scroller = document.querySelector<HTMLElement>(".canvas-scroll");
    const boardRect = board?.getBoundingClientRect();
    const scrollerRect = scroller?.getBoundingClientRect();
    const blockWidth = 640;
    const blockHeight = 180;

    if (!boardRect || !scrollerRect) {
      return { x: 0, y: 0 };
    }

    const centerX = scrollerRect.left + scrollerRect.width / 2;
    const centerY = scrollerRect.top + scrollerRect.height / 2;

    return {
      x: Math.max(0, (centerX - boardRect.left) / treeScale - blockWidth / 2),
      y: Math.max(0, (centerY - boardRect.top) / treeScale - blockHeight / 2),
    };
  }
  function addCustomBlock() {
    const id = `custom-${Date.now()}`;
    const newBlock = createCustomBlock(id);
    const position = getStockBlockPosition();

    setCustomBlocks((currentBlocks) => [...currentBlocks, newBlock]);
    setAbsoluteBlockIds((currentIds) => new Set(currentIds).add(id));
    setBlockPositions((currentPositions) => ({ ...currentPositions, [id]: position }));
    setFlashingBlockId(null);
    setEditHistory((currentHistory) => [...currentHistory, { type: "add-block", id }]);
  }

  function addAdjacentBlock(sourceBlockId: string, side: BlockSide) {
    const source = document.getElementById(sourceBlockId);
    const board = document.querySelector<HTMLElement>(".tree-board");

    if (!source || !board) {
      addCustomBlock();
      return;
    }

    const id = `custom-${Date.now()}`;
    const newBlock = createCustomBlock(id);
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

    setCustomBlocks((currentBlocks) => [...currentBlocks, newBlock]);
    setAbsoluteBlockIds((currentIds) => new Set(currentIds).add(id));
    setBlockPositions((currentPositions) => ({ ...currentPositions, [id]: position }));
    setSelectedBlockId(id);
    setFlashingBlockId(null);
    setEditHistory((currentHistory) => [...currentHistory, { type: "add-block", id }]);
  }

  function requestDeleteBlock(blockId: string) {
    const block = dialogueBlocks.find((item) => item.id === blockId) ?? customBlocks.find((item) => item.id === blockId);
    setPendingEditDelete({ type: "block", id: blockId, label: block?.title ?? "block" });
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

  function confirmEditDelete() {
    if (!pendingEditDelete) {
      return;
    }

    const customBlock = customBlocks.find((block) => block.id === pendingEditDelete.id);
    setEditHistory((currentHistory) => [...currentHistory, { type: "delete-block", id: pendingEditDelete.id, customBlock }]);
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
    setPendingEditDelete(null);
  }

  const getAvailableSides = (block: DialogueBlock) => getAvailableSidesForBlock(block, absoluteBlockIds);
  const resolveCustomOptions = (blockId: string) => resolveCustomOptionsForBlock(blockId, customOptionsByBlock, allBlockTitles);

  return {
    absoluteBlockIds,
    addAdjacentBlock,
    addCustomBlock,
    addCustomOption,
    blockPositions,
    confirmEditDelete,
    customBlocks,
    customOptionConflicts,
    deletedBlockIds,
    deletedButtonKeys,
    editHistory,
    getAvailableSides,
    isEditMode,
    pendingEditDelete,
    requestDeleteBlock,
    resolveCustomOptions,
    setIsEditMode,
    setPendingEditDelete,
    startMoveBlock,
    toggleEditMode,
    undoEdit,
    updateCustomOption,
  };
}



