import type { DialogueBlock } from "../dialogueTree";

export type BlockSide = "top" | "right" | "bottom" | "left";

export type CustomOption = {
  id: string;
  label: string;
  target?: string;
  hasConflict?: boolean;
};

export type PendingEditDelete = {
  type: "block";
  id: string;
  label: string;
} | null;

export type BlockPositionMap = Record<string, { x: number; y: number }>;
export type CustomOptionMap = Record<string, { id: string; label: string }[]>;

export type EditAction =
  | { type: "delete-block"; id: string; customBlock?: DialogueBlock }
  | { type: "add-block"; id: string };
