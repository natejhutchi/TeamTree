import { useState, type CSSProperties, type MouseEvent, type PointerEvent } from "react";
import { HighlighterIcon } from "lucide-react";
import { Icon, type IconName } from "../components/Icon";

const toolbarColors = [
  { label: "Black", value: "#20301f" },
  { label: "Muted grey", value: "#596a51" },
  { label: "Button grey", value: "#4f554b" },
  { label: "Button red", value: "#b83224" },
  { label: "Button yellow", value: "#b87900" },
  { label: "Button blue", value: "#2457b8" },
  { label: "Button green", value: "#087a2f" },
];

const alignments: Array<{ command: string; icon: IconName; label: string }> = [
  { command: "justifyLeft", icon: "alignLeft", label: "Align left" },
  { command: "justifyCenter", icon: "alignCenter", label: "Align center" },
  { command: "justifyRight", icon: "alignRight", label: "Align right" },
];

function runEditCommand(command: string, value?: string) {
  const shouldRunLegacyCommand = window.dispatchEvent(new CustomEvent("teamtown:tiptap-command", {
    cancelable: true,
    detail: { command, value },
  }));

  if (shouldRunLegacyCommand) {
    document.execCommand(command, false, value);
  }
}

function dispatchEditorInput(element: Element | null) {
  const editor = element?.closest('[contenteditable="true"]') ?? document.activeElement?.closest?.('[contenteditable="true"]');
  editor?.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "formatSetBlockTextDirection" }));
}

function dispatchActiveEditorInput() {
  dispatchEditorInput(document.activeElement instanceof Element ? document.activeElement : null);
}

function getSelectedIndentElement() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  const node = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
    ? range.commonAncestorContainer
    : range.commonAncestorContainer.parentElement;

  if (!(node instanceof Element)) return null;

  return node.closest<HTMLElement>(".editable-script-line, .script-list");
}

function adjustScriptIndent(direction: -1 | 1) {
  const target = getSelectedIndentElement();

  if (!target) {
    runEditCommand(direction < 0 ? "outdent" : "indent");
    return;
  }

  const inlineIndent = target.style.getPropertyValue("--indent");
  const computedIndent = getComputedStyle(target).getPropertyValue("--indent");
  const currentIndent = Number.parseInt(inlineIndent || computedIndent || "0", 10);
  const nextIndent = Math.max(0, (Number.isFinite(currentIndent) ? currentIndent : 0) + direction);

  target.style.setProperty("--indent", String(nextIndent));
  dispatchEditorInput(target);
}

function preventToolbarBlur(event: MouseEvent) {
  event.preventDefault();
  event.stopPropagation();
}

function handleToolbarPointerDown(event: PointerEvent) {
  event.preventDefault();
  event.stopPropagation();
}

function runToolbarAction(event: PointerEvent<HTMLButtonElement>, action: () => void) {
  event.preventDefault();
  event.stopPropagation();
  action();
  requestAnimationFrame(dispatchActiveEditorInput);
}

export function EditTextToolbar({
  canDelete,
  deleteLabel,
  onDelete,
  isStarterBlock = false,
  onSetStarterBlock,
  onCycleHighlight,
  showHeadingControl = false,
}: {
  canDelete: boolean;
  deleteLabel: string;
  onDelete: () => void;
  isStarterBlock?: boolean;
  onSetStarterBlock?: () => void;
  onCycleHighlight?: () => void;
  showHeadingControl?: boolean;
}) {
  const [alignmentIndex, setAlignmentIndex] = useState(0);
  const [listIndex, setListIndex] = useState(0);
  const alignment = alignments[alignmentIndex];
  function cycleList() {
    const nextIndex = (listIndex + 1) % 3;
    const currentList = document.queryCommandState("insertUnorderedList") ? "bullet" : document.queryCommandState("insertOrderedList") ? "numbered" : "none";

    if (currentList === "bullet") runEditCommand("insertUnorderedList");
    if (currentList === "numbered") runEditCommand("insertOrderedList");
    if (nextIndex === 1) runEditCommand("insertUnorderedList");
    if (nextIndex === 2) runEditCommand("insertOrderedList");
    setListIndex(nextIndex);
  }
  function cycleAlignment() {
    const nextIndex = (alignmentIndex + 1) % alignments.length;
    const nextAlignment = alignments[nextIndex];
    setAlignmentIndex(nextIndex);
    runEditCommand(nextAlignment.command);
  }

  return (
    <div className="text-edit-toolbar" onMouseDown={preventToolbarBlur} onPointerDown={handleToolbarPointerDown}>
      <div className="text-edit-toolbar-left">
        <button aria-label={deleteLabel} disabled={!canDelete} onPointerDown={(event) => runToolbarAction(event, onDelete)} type="button"><Icon name="trash2" /></button>
      </div>
      <div className="text-edit-toolbar-center">
        {onSetStarterBlock ? <button aria-label={isStarterBlock ? "Starter block" : "Set as starter block"} className={isStarterBlock ? "is-starter-block" : "is-not-starter-block"} disabled={isStarterBlock} onPointerDown={(event) => runToolbarAction(event, onSetStarterBlock)} type="button"><Icon name="flag" /></button> : null}
        {onCycleHighlight ? <button aria-label="Cycle highlight paragraph" className="highlight-cycle-button" onPointerDown={(event) => runToolbarAction(event, onCycleHighlight)} type="button"><HighlighterIcon aria-hidden="true" size={20} strokeWidth={1.75} /></button> : null}
        <button aria-label="Outdent text" onPointerDown={(event) => runToolbarAction(event, () => adjustScriptIndent(-1))} type="button"><Icon name="arrowLeftToLine" /></button>
        <button aria-label="Indent text" onPointerDown={(event) => runToolbarAction(event, () => adjustScriptIndent(1))} type="button"><Icon name="arrowRightToLine" /></button>
        <button aria-label="Bold text" onPointerDown={(event) => runToolbarAction(event, () => runEditCommand("bold"))} type="button"><Icon name="bold" /></button>
        <button aria-label="Italic text" onPointerDown={(event) => runToolbarAction(event, () => runEditCommand("italic"))} type="button"><Icon name="italic" /></button>
        <button aria-label="Toggle list style" onPointerDown={(event) => runToolbarAction(event, cycleList)} type="button"><Icon name="list" /></button>
        <button aria-label={alignment.label} onPointerDown={(event) => runToolbarAction(event, cycleAlignment)} type="button"><Icon name={alignment.icon} /></button>
        {showHeadingControl ? <button aria-label="Toggle heading" onPointerDown={(event) => runToolbarAction(event, () => runEditCommand("formatBlock", "h3"))} type="button"><Icon name="type" /></button> : null}
      </div>
      <div className="text-color-tools" aria-label="Text colors">
        {toolbarColors.map((color) => (
          <button aria-label={color.label} className="text-color-swatch" key={color.value} onPointerDown={(event) => runToolbarAction(event, () => runEditCommand("foreColor", color.value))} style={{ "--swatch-color": color.value } as CSSProperties} type="button" />
        ))}
      </div>
    </div>
  );
}
















