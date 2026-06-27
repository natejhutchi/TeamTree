import type { DialogueBlock } from "../dialogueTree";
import type { BlockSide, CustomOption, CustomOptionMap } from "./editTypes";

export function createCustomBlock(id = `custom-${Date.now()}`): DialogueBlock {
  return {
    id,
    title: "Title",
    layoutArea: "custom",
    lines: [{ parts: [{ kind: "text", text: "Type your lines\nAny text that matches another block's title will automatically become a transfer button. Transfer buttons are case sensitive." }] }],
  };
}

export function createCustomOption(id = `option-${Date.now()}`) {
  return { id, label: "Button" };
}

export function getAllBlockTitles(blocks: DialogueBlock[]) {
  return blocks.reduce<Record<string, string[]>>((titles, block) => {
    const normalizedTitle = block.title.trim().toLowerCase();

    if (!normalizedTitle) {
      return titles;
    }

    titles[normalizedTitle] = [...(titles[normalizedTitle] ?? []), block.id];
    return titles;
  }, {});
}

export function getCustomOptionConflicts(customOptionsByBlock: CustomOptionMap, allBlockTitles: Record<string, string[]>) {
  return Object.entries(customOptionsByBlock).flatMap(([blockId, options]) => (
    options.flatMap((option) => {
      const matches = allBlockTitles[option.label.trim().toLowerCase()] ?? [];
      return matches.length > 1 ? [{ blockId, label: option.label, matches }] : [];
    })
  ));
}

export function getAvailableSides(block: DialogueBlock, absoluteBlockIds: Set<string>): BlockSide[] {
  if (absoluteBlockIds.has(block.id) || block.id.startsWith("custom-")) {
    return ["top", "right", "bottom", "left"];
  }

  const sidesByBlock: Record<string, BlockSide[]> = {
    start: ["top", "left"],
    rush: ["top", "right"],
    sure: ["left"],
    "whos-this": ["right"],
    confusion: ["left"],
    "spot-were-in": ["left", "bottom"],
    "different-ai": ["right"],
    "different-designer": ["right"],
    "using-ai": ["right"],
    "not-using-ai": ["right", "bottom"],
    solution: ["left", "bottom"],
    "rush-bullet": ["right", "bottom"],
    close: ["bottom"],
    "graceful-exit": ["bottom"],
  };

  return sidesByBlock[block.id] ?? [];
}

export function resolveCustomOptions(blockId: string, customOptionsByBlock: CustomOptionMap, allBlockTitles: Record<string, string[]>): CustomOption[] {
  return (customOptionsByBlock[blockId] ?? []).map((option) => {
    const matches = allBlockTitles[option.label.trim().toLowerCase()] ?? [];

    return {
      ...option,
      hasConflict: matches.length > 1,
      target: matches.length === 1 ? matches[0] : undefined,
    };
  });
}






