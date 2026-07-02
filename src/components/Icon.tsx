import { AlignCenter, AlignLeft, AlignRight, Archive, ArrowLeftToLine, ArrowRightToLine, Badge, Bold, Check, ChevronDown, Copy, Download, Flag, Highlighter, Italic, List, Move, MousePointerBan, NotebookPen, Pencil, Plus, Redo2, Settings, SquarePen, SquarePlus, SquareMousePointer, Trash2, TreeDeciduous, Type, Undo2, UserRound, X, type LucideIcon } from "lucide-react";

export type IconName = "alignCenter" | "alignLeft" | "alignRight" | "archive" | "arrowLeftToLine" | "arrowRightToLine" | "badge" | "bold" | "check" | "chevronDown" | "copy" | "download" | "flag" | "italic" | "list" | "move" | "mousePointerBan" | "notebookPen" | "pencil" | "plus" | "redo" | "settings" | "highlighter" | "squarePen" | "squarePlus" | "squarePull" | "trash2" | "treeDeciduous" | "type" | "undo" | "userRound" | "x";

const icons: Record<IconName, LucideIcon> = {
  alignCenter: AlignCenter,
  alignLeft: AlignLeft,
  alignRight: AlignRight,
  archive: Archive,
  arrowLeftToLine: ArrowLeftToLine,
  arrowRightToLine: ArrowRightToLine,
  badge: Badge,
  bold: Bold,
  check: Check,
  chevronDown: ChevronDown,
  copy: Copy,
  download: Download,
  flag: Flag,
  italic: Italic,
  list: List,
  move: Move,
  mousePointerBan: MousePointerBan,
  notebookPen: NotebookPen,
  pencil: Pencil,
  plus: Plus,
  redo: Redo2,
  settings: Settings,
  highlighter: Highlighter,
  squarePen: SquarePen,
  squarePlus: SquarePlus,
  squarePull: SquareMousePointer,
  trash2: Trash2,
  treeDeciduous: TreeDeciduous,
  type: Type,
  undo: Undo2,
  userRound: UserRound,
  x: X,
};

export function Icon({ name }: { name: IconName }) {
  const LucideIconComponent = icons[name] ?? Badge;

  return <LucideIconComponent aria-hidden="true" size={20} strokeWidth={1.75} />;
}












