import type { DialogueBlock } from "./dialogueTree";
import type { BlockPositionMap, BlockZIndexMap } from "./editing/editTypes";

export type TreeBlockOverrides = Record<string, {
  title?: string;
  bodyHtml?: string;
}>;

export type TreePanels = {
  team?: Record<string, string>;
  objections?: Record<string, string>;
  bottom?: Record<string, string>;
  bottomClientsHtml?: string;
};

export type TreePanelDocument = {
  top?: {
    announcements?: string[];
    notes?: string[];
  };
  team?: Record<string, string>;
  objections?: Record<string, string>;
  bottom?: Record<string, string>;
  bottomClientsHtml?: string;
};

export type TeamTreeData = {
  version: 1;
  source?: string;
  blocks: DialogueBlock[];
  panels: TreePanelDocument;
  starterBlockId: string;
  hideDefaultBlocks: boolean;
  notes: string[];
  hiddenAnnouncementIndexes: number[];
  blockPositions: BlockPositionMap;
  blockZIndexes: BlockZIndexMap;
  absoluteBlockIds: string[];
  blockOverrides: TreeBlockOverrides;
};

export const emptyTreeData = (): TeamTreeData => ({
  version: 1,
  blocks: [],
  panels: {},
  starterBlockId: "start",
  hideDefaultBlocks: true,
  notes: [],
  hiddenAnnouncementIndexes: [],
  blockPositions: {},
  blockZIndexes: {},
  absoluteBlockIds: [],
  blockOverrides: {},
});

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => Number.isInteger(item));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isDialogueBlockArray(value: unknown): value is DialogueBlock[] {
  return Array.isArray(value) && value.every((item) => {
    const block = item as DialogueBlock;
    return typeof block?.id === "string" && typeof block.title === "string" && typeof block.layoutArea === "string";
  });
}

function normalizeBlockPositions(value: unknown): BlockPositionMap {
  if (!isRecord(value)) return {};

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, { x: number; y: number }] => {
      const position = entry[1] as { x?: unknown; y?: unknown };
      return typeof entry[0] === "string" && typeof position?.x === "number" && typeof position.y === "number";
    }),
  );
}

function normalizeBlockZIndexes(value: unknown): BlockZIndexMap {
  if (!isRecord(value)) return {};

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, number] => (
      typeof entry[0] === "string" && typeof entry[1] === "number" && Number.isFinite(entry[1])
    )),
  );
}


function normalizeStringRecord(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) return undefined;

  const entries = Object.entries(value).filter((entry): entry is [string, string] => (
    typeof entry[0] === "string" && typeof entry[1] === "string"
  ));

  return entries.length ? Object.fromEntries(entries) : undefined;
}

function normalizeLegacyPanels(value: unknown): TreePanels {
  if (!isRecord(value)) return {};

  const nextPanels: TreePanels = {};
  const team = normalizeStringRecord(value.team);
  const objections = normalizeStringRecord(value.objections);
  const bottom = normalizeStringRecord(value.bottom);

  if (team) nextPanels.team = team;
  if (objections) nextPanels.objections = objections;
  if (bottom) nextPanels.bottom = bottom;
  if (typeof value.bottomClientsHtml === "string") nextPanels.bottomClientsHtml = value.bottomClientsHtml;

  return nextPanels;
}

function normalizePanels(value: unknown, fallbackPanels: TreePanels = {}): TreePanelDocument {
  if (!isRecord(value)) return { ...fallbackPanels };

  const nextPanels: TreePanelDocument = { ...fallbackPanels };
  const team = normalizeStringRecord(value.team);
  const objections = normalizeStringRecord(value.objections);
  const bottom = normalizeStringRecord(value.bottom);

  if (team) nextPanels.team = team;
  if (objections) nextPanels.objections = objections;
  if (bottom) nextPanels.bottom = bottom;
  if (typeof value.bottomClientsHtml === "string") nextPanels.bottomClientsHtml = value.bottomClientsHtml;

  if (isRecord(value.top)) {
    const top: TreePanelDocument["top"] = {};
    if (isStringArray(value.top.announcements)) top.announcements = value.top.announcements;
    if (isStringArray(value.top.notes)) top.notes = value.top.notes;
    if (Object.keys(top).length) nextPanels.top = top;
  }

  return nextPanels;
}
function normalizeBlockOverrides(value: unknown): TreeBlockOverrides {
  if (!isRecord(value)) return {};

  return Object.fromEntries(
    Object.entries(value).flatMap(([blockId, override]) => {
      if (!isRecord(override)) return [];
      const nextOverride: { title?: string; bodyHtml?: string } = {};
      if (typeof override.title === "string") nextOverride.title = override.title;
      if (typeof override.bodyHtml === "string") nextOverride.bodyHtml = override.bodyHtml;
      return Object.keys(nextOverride).length ? [[blockId, nextOverride]] : [];
    }),
  );
}

export function normalizeTreeData(value: unknown): TeamTreeData {
  const base = emptyTreeData();

  if (!isRecord(value)) return base;

  const legacyPanels = normalizeLegacyPanels(value.panelOverrides);
  const blocks = isDialogueBlockArray(value.blocks) ? value.blocks : base.blocks;

  return {
    version: 1,
    source: typeof value.source === "string" ? value.source : undefined,
    blocks,
    panels: normalizePanels(value.panels, legacyPanels),
    starterBlockId: typeof value.starterBlockId === "string" ? value.starterBlockId : base.starterBlockId,
    hideDefaultBlocks: true,
    notes: isStringArray(value.notes) ? value.notes : base.notes,
    hiddenAnnouncementIndexes: isNumberArray(value.hiddenAnnouncementIndexes) ? value.hiddenAnnouncementIndexes : base.hiddenAnnouncementIndexes,
    blockPositions: normalizeBlockPositions(value.blockPositions),
    blockZIndexes: normalizeBlockZIndexes(value.blockZIndexes),
    absoluteBlockIds: isStringArray(value.absoluteBlockIds) ? value.absoluteBlockIds : base.absoluteBlockIds,
    blockOverrides: normalizeBlockOverrides(value.blockOverrides),
  };
}

















