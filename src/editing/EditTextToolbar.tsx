import { useState, type CSSProperties, type MouseEvent } from "react";
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
  document.execCommand(command, false, value);
}

function preventToolbarBlur(event: MouseEvent) {
  event.preventDefault();
  event.stopPropagation();
}

export function EditTextToolbar({
  canDelete,
  deleteLabel,
  onDelete,
}: {
  canDelete: boolean;
  deleteLabel: string;
  onDelete: () => void;
}) {
  const [alignmentIndex, setAlignmentIndex] = useState(0);
  const alignment = alignments[alignmentIndex];

  function cycleAlignment() {
    const nextIndex = (alignmentIndex + 1) % alignments.length;
    const nextAlignment = alignments[nextIndex];
    setAlignmentIndex(nextIndex);
    runEditCommand(nextAlignment.command);
  }

  return (
    <div className="text-edit-toolbar" onMouseDown={preventToolbarBlur}>
      <div className="text-edit-toolbar-left">
        <button aria-label={deleteLabel} disabled={!canDelete} onClick={onDelete} type="button"><Icon name="trash2" /></button>
      </div>
      <div className="text-edit-toolbar-center">
        <button aria-label="Outdent text" onClick={() => runEditCommand("outdent")} type="button"><Icon name="arrowLeftToLine" /></button>
        <button aria-label="Indent text" onClick={() => runEditCommand("indent")} type="button"><Icon name="arrowRightToLine" /></button>
        <button aria-label="Bold text" onClick={() => runEditCommand("bold")} type="button"><Icon name="bold" /></button>
        <button aria-label="Italic text" onClick={() => runEditCommand("italic")} type="button"><Icon name="italic" /></button>
        <button aria-label={alignment.label} onClick={cycleAlignment} type="button"><Icon name={alignment.icon} /></button>
      </div>
      <div className="text-color-tools" aria-label="Text colors">
        {toolbarColors.map((color) => (
          <button aria-label={color.label} className="text-color-swatch" key={color.value} onClick={() => runEditCommand("foreColor", color.value)} style={{ "--swatch-color": color.value } as CSSProperties} type="button" />
        ))}
      </div>
    </div>
  );
}


