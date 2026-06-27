import { AlignCenter, AlignLeft, AlignRight, Archive, ArrowLeftToLine, ArrowRightToLine, Badge, Bold, ChevronDown, Italic, Move, MousePointerBan, NotebookPen, Plus, SquarePen, SquarePlus, SquareMousePointer, Trash2, TreeDeciduous, Type, Undo2, UserRound, X, ZoomIn, ZoomOut, type LucideIcon } from "lucide-react";

export type IconName = "alignCenter" | "alignLeft" | "alignRight" | "archive" | "arrowLeftToLine" | "arrowRightToLine" | "badge" | "bold" | "chevronDown" | "italic" | "move" | "mousePointerBan" | "notebookPen" | "plus" | "squarePen" | "squarePlus" | "squarePull" | "trash2" | "treeDeciduous" | "type" | "undo" | "userRound" | "x" | "zoomIn" | "zoomOut";

const icons: Record<IconName, LucideIcon> = {
  alignCenter: AlignCenter,
  alignLeft: AlignLeft,
  alignRight: AlignRight,
  archive: Archive,
  arrowLeftToLine: ArrowLeftToLine,
  arrowRightToLine: ArrowRightToLine,
  badge: Badge,
  bold: Bold,
  chevronDown: ChevronDown,
  italic: Italic,
  move: Move,
  mousePointerBan: MousePointerBan,
  notebookPen: NotebookPen,
  plus: Plus,
  squarePen: SquarePen,
  squarePlus: SquarePlus,
  squarePull: SquareMousePointer,
  trash2: Trash2,
  treeDeciduous: TreeDeciduous,
  type: Type,
  undo: Undo2,
  userRound: UserRound,
  x: X,
  zoomIn: ZoomIn,
  zoomOut: ZoomOut,
};

export function Icon({ name }: { name: IconName }) {
  const LucideIconComponent = icons[name];

  return <LucideIconComponent aria-hidden="true" size={20} strokeWidth={1.75} />;
}


