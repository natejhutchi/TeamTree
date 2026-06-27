import React, { useMemo } from "react";
import { getButtonRows, type DialogueBlock, type ScriptContent, type ScriptLine, type TextPart } from "../dialogueTree";
import { EditDeleteConfirm } from "../editing/EditDeleteConfirm";
import { EditTextToolbar } from "../editing/EditTextToolbar";
import type { CustomOption, PendingEditDelete } from "../editing/editTypes";
import { type NameValues, type NavigateToBlock, isScriptHeading, ScriptContentView, ScriptLineView } from "./scriptRendering";

const earlyRushBlockIds = new Set(["start", "sure", "whos-this"]);
const noBusyButtonBlockIds = new Set(["rush", "rush-bullet", "solution", "close", "graceful-exit"]);

function normalizeEditorPlaceholders(value: string) {
  let nameTokenIndex = 0;

  return value.replace(/\[\[(?:Your\s+|Prospect\s+|Full\s+)?Name\]\]|\[\[(?:Prospect|Rep)\]\]/gi, (token) => {
    const normalizedToken = token.toLowerCase();

    if (normalizedToken.includes("prospect")) {
      return "[[Prospect]]";
    }

    if (normalizedToken.includes("your") || normalizedToken.includes("full") || normalizedToken.includes("rep")) {
      return "[[Rep]]";
    }

    const replacement = nameTokenIndex === 0 ? "[[Prospect]]" : "[[Rep]]";
    nameTokenIndex += 1;
    return replacement;
  });
}

function textPartToPlainText(part: TextPart) {
  if ("text" in part) {
    return normalizeEditorPlaceholders(part.text);
  }

  if ("label" in part) {
    return normalizeEditorPlaceholders(part.label);
  }

  return "";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function textToEditableHtml(value: string) {
  if (!value.trim()) {
    return "<div><br></div>";
  }

  return value
    .split("\n")
    .map((line) => `<div>${escapeHtml(line) || "<br>"}</div>`)
    .join("");
}

function getChoiceToneClass(label: string, target?: string) {
  const normalizedLabel = label.toLowerCase();

  if (target === "solution" || normalizedLabel === "solution") {
    return "editable-body-choice-solution";
  }

  if (target === "graceful-exit" || normalizedLabel === "graceful exit") {
    return "editable-body-choice-exit";
  }

  if (target === "close" || normalizedLabel === "close") {
    return "editable-body-choice-close";
  }

  if (normalizedLabel.includes("busy") || normalizedLabel.includes("impatient")) {
    return "editable-body-choice-busy";
  }

  return "editable-body-choice-default";
}

function lineToPlainText(line: ScriptLine) {
  const prefix = line.indent ? `${"  ".repeat(line.indent)}` : "";
  return `${prefix}${line.parts.map(textPartToPlainText).join("")}`;
}

function scriptContentToPlainText(content: ScriptContent) {
  if ("items" in content) {
    const prefix = content.indent ? `${"  ".repeat(content.indent)}` : "";
    return content.items.map((item, index) => `${prefix}${index + 1}. ${item}`).join("\n");
  }

  return lineToPlainText(content);
}

function getBlockBodyText(block: DialogueBlock) {
  const normalizedTitle = block.title.trim().toLowerCase();
  const scriptSections = (block.script ?? [])
    .filter((content) => !(isScriptHeading(content) && scriptContentToPlainText(content).trim().toLowerCase() === normalizedTitle))
    .map(scriptContentToPlainText);
  const sections = [
    ...(block.lines ?? []).map(lineToPlainText),
    ...(block.mutedLabels ?? []).map(normalizeEditorPlaceholders),
    ...(block.responseLines ?? []).map(lineToPlainText),
    ...scriptSections,
  ].filter((section) => section.trim().length > 0);

  return sections.join("\n\n");
}

function getEditableBodyHtml({
  block,
  buttonRows,
  customOptions,
  showBusyButton,
  busyTarget,
  busyLabel,
}: {
  block: DialogueBlock;
  buttonRows: ReturnType<typeof getButtonRows>;
  customOptions: CustomOption[];
  showBusyButton: boolean;
  busyTarget: string;
  busyLabel: string;
}) {
  const bodyHtml = textToEditableHtml(getBlockBodyText(block));
  const choices = [
    ...buttonRows.flatMap((row) => row.map((button) => ({ label: button.label, target: button.target }))),
    ...customOptions.map((option) => ({ label: option.label, target: option.target })),
    ...(showBusyButton ? [{ label: busyLabel, target: busyTarget }] : []),
  ];
  const choiceHtml = choices
    .map((choice) => `<div class="editable-body-choice ${getChoiceToneClass(choice.label, choice.target)}"><strong>${escapeHtml(choice.label)}</strong></div>`)
    .join("");

  return `${bodyHtml}${choiceHtml ? `<div><br></div>${choiceHtml}` : ""}`;
}

export function DialogueCard({
  block,
  deletedButtonKeys,
  customOptions = [],
  isAbsolute = false,
  isEditMode,
  isFlashing,
  isSelected,
  names,
  navigateToBlock,
  onRequestDeleteBlock,
  onStartMoveBlock,
  onUpdateOption,
  pendingEditDelete,
  onCancelDelete,
  onConfirmDelete,
  position,
}: {
  block: DialogueBlock;
  customOptions?: CustomOption[];
  deletedButtonKeys: Set<string>;
  isAbsolute?: boolean;
  isEditMode: boolean;
  isFlashing: boolean;
  isSelected: boolean;
  names: NameValues;
  navigateToBlock: NavigateToBlock;
  onRequestDeleteBlock: (blockId: string) => void;
  onStartMoveBlock: (blockId: string, event: React.PointerEvent<HTMLElement>) => void;
  onUpdateOption: (blockId: string, optionId: string, label: string) => void;
  pendingEditDelete?: PendingEditDelete;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  position?: { x: number; y: number };
}) {
  const buttonRows = getButtonRows(block);
  const isCustomBlock = block.id.startsWith("custom-");
  const busyTarget = isCustomBlock ? block.id : earlyRushBlockIds.has(block.id) ? "rush" : "rush-bullet";
  const busyLabel = isCustomBlock ? "Potential Transfer Button" : "Busy / Impatient";
  const showBusyButton = !noBusyButtonBlockIds.has(block.id) && !deletedButtonKeys.has(`${block.id}:busy`);
  const hasScript = block.script && block.script.length > 0;
  const firstLineIsFlashTarget = isFlashing && Boolean(block.lines?.length);
  const firstResponseIsFlashTarget = isFlashing && !block.lines?.length && Boolean(block.responseLines?.length);
  const firstScriptFlashIndex = block.script?.[0] && isScriptHeading(block.script[0]) ? 1 : 0;
  const firstScriptIsFlashTarget = isFlashing && !block.lines?.length && !block.responseLines?.length;
  const editableBodyHtml = useMemo(() => getEditableBodyHtml({ block, buttonRows, customOptions, showBusyButton, busyTarget, busyLabel }), [block, buttonRows, customOptions, showBusyButton, busyTarget, busyLabel]);
  const pendingBlockDelete = pendingEditDelete?.type === "block" && pendingEditDelete.id === block.id ? pendingEditDelete : null;
  const positionStyle = isAbsolute
    ? { left: position?.x ?? 0, position: "absolute", top: position?.y ?? 0 } as React.CSSProperties
    : { transform: `translate(${position?.x ?? 0}px, ${position?.y ?? 0}px)` } as React.CSSProperties;

  const handleChoiceClick = (event: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    event.preventDefault();

    if (isEditMode || !isSelected) {
      return;
    }

    event.stopPropagation();
    navigateToBlock(targetId);
  };

  const requestBlockDelete = () => {
    onRequestDeleteBlock(block.id);
  };

  const isControlTarget = (target: EventTarget | null) => (
    target instanceof HTMLElement && Boolean(target.closest("button, a, [contenteditable=\"true\"], .edit-delete-confirm"))
  );

  return (
    <article
      className={`dialogue-block ${hasScript ? "script-block" : "choice-block"} ${!isEditMode && isSelected ? "is-selected" : ""} ${!isEditMode && !isSelected ? "is-muted" : ""} ${isAbsolute ? "is-absolute-block" : ""}`}
      id={block.id}
      onPointerDown={(event) => {
        if (isEditMode && !isControlTarget(event.target)) {
          onStartMoveBlock(block.id, event);
        }
      }}
      onClick={() => {
        if (!isEditMode) {
          navigateToBlock(block.id);
        }
      }}
      style={positionStyle}
    >
      {isEditMode ? (
        <EditTextToolbar
          canDelete={true}
          deleteLabel="Delete block"
          onDelete={requestBlockDelete}
        />
      ) : null}

      {pendingBlockDelete ? (
        <EditDeleteConfirm pendingEditDelete={pendingBlockDelete} onCancel={onCancelDelete} onConfirm={onConfirmDelete} />
      ) : null}

      <h2
        contentEditable={isEditMode}
        data-text-key={`${block.id}:title`}
        suppressContentEditableWarning={true}
      >
        {block.title}
      </h2>

      {isEditMode ? (
        <div
          className="block-content block-body-editor"
          contentEditable={true}
          dangerouslySetInnerHTML={{ __html: editableBodyHtml }}
          data-text-key={`${block.id}:body`}
          suppressContentEditableWarning={true}
        />
      ) : (
        <div className="block-content">
          {block.lines?.map((line, index) => {
            const optionKey = `${block.id}:line:${index}`;

            if (deletedButtonKeys.has(optionKey)) {
              return null;
            }

            return <ScriptLineView deleteKey={optionKey} editingTextKey={null} isBlockSelected={isSelected} isEditMode={false} isFlashing={firstLineIsFlashTarget && index === 0} key={`${block.id}-line-${index}`} line={line} names={names} navigateToBlock={navigateToBlock} selectedTextKey={null} />;
          })}
          {block.mutedLabels?.map((label, labelIndex) => (
            <span className="muted-label" aria-disabled="true" key={`${label}-${labelIndex}`}>{label}</span>
          ))}
          {block.responseLines?.map((line, index) => {
            const optionKey = `${block.id}:response:${index}`;

            if (deletedButtonKeys.has(optionKey)) {
              return null;
            }

            return <ScriptLineView deleteKey={optionKey} editingTextKey={null} isBlockSelected={isSelected} isEditMode={false} isFlashing={firstResponseIsFlashTarget && index === 0} key={`${block.id}-response-${index}`} line={line} names={names} navigateToBlock={navigateToBlock} selectedTextKey={null} />;
          })}
          {block.script?.map((content, index) => {
            const optionKey = `${block.id}:script:${index}`;

            if (deletedButtonKeys.has(optionKey)) {
              return null;
            }

            return <ScriptContentView content={content} deleteKey={optionKey} editingTextKey={null} isBlockSelected={isSelected} isEditMode={false} isFlashing={firstScriptIsFlashTarget && index === firstScriptFlashIndex} key={`${block.id}-script-${index}`} names={names} navigateToBlock={navigateToBlock} selectedTextKey={null} />;
          })}
        </div>
      )}

      {!isEditMode ? <div className="button-stack" aria-label={`${block.title} choices`}>
        {buttonRows.map((row, rowIndex) => (
          <div className="button-row" key={`${block.id}-row-${rowIndex}`}>
            {row.map((button, buttonIndex) => {
              const buttonKey = `${block.id}:${rowIndex}:${buttonIndex}`;

              if (deletedButtonKeys.has(buttonKey)) {
                return null;
              }

              return (
                <span className="editable-choice" key={`${button.target}-${buttonIndex}`}>
                  <a className="choice-button" href={`#${button.target}`} onClick={(event) => handleChoiceClick(event, button.target)}>{button.label}</a>
                </span>
              );
            })}
          </div>
        ))}
        {customOptions.map((option) => {
          const optionKey = `${block.id}:custom-option:${option.id}`;

          if (deletedButtonKeys.has(optionKey)) {
            return null;
          }

          return (
            <span className={`editable-choice ${option.hasConflict ? "has-conflict" : ""}`} key={option.id}>
              <a className="choice-button" href={option.target ? `#${option.target}` : "#"} onBlur={(event) => onUpdateOption(block.id, option.id, event.currentTarget.textContent?.trim() || "Button")} onClick={(event) => handleChoiceClick(event, option.target ?? block.id)}>{option.label}</a>
            </span>
          );
        })}
        {showBusyButton ? (
          <span className="editable-choice">
            <a className="choice-button busy-button" href={`#${busyTarget}`} onClick={(event) => handleChoiceClick(event, busyTarget)}>{busyLabel}</a>
          </span>
        ) : null}
      </div> : null}
    </article>
  );
}









