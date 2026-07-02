import React, { useEffect, useRef, useState } from "react";
import { getButtonRows, type DialogueBlock, type ScriptContent, type ScriptLine, type TextPart } from "../dialogueTree";
import { EditDeleteConfirm } from "../editing/EditDeleteConfirm";
import { EditTextToolbar } from "../editing/EditTextToolbar";
import type { CustomOption, PendingEditDelete } from "../editing/editTypes";
import type { TreeBlockOverrides } from "../treeData";
import { linkHtmlWithTransferButtons, type TransferTitleTargets } from "./transferRendering";
import { type NameValues, type NavigateToBlock, isScriptHeading, ScriptContentView, ScriptLineView } from "./scriptRendering";
import { TiptapBlockBody } from "./TiptapBlockBody";

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



function placeCaretInElement(element: HTMLElement, atStart = false) {
  const selection = window.getSelection();
  if (!selection) return;

  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(atStart);
  selection.removeAllRanges();
  selection.addRange(range);
}

function hasVisibleContent(node: Node) {
  return (node.textContent ?? "").replace(/\u00a0/g, "").trim().length > 0 || node.nodeName === "BR";
}

function appendBlankLine(root: HTMLElement) {
  const line = document.createElement("div");
  line.className = "editable-script-line is-empty-editable-line";
  line.style.setProperty("--indent", "0");
  line.innerHTML = "<br>";
  root.appendChild(line);
  placeCaretInElement(line, true);
}

function splitEditableChoice(root: HTMLElement, range: Range, choice: HTMLElement, row: HTMLElement) {
  const nextRow = document.createElement("div");
  nextRow.className = row.className || "editable-button-row";

  const nextChoice = choice.cloneNode(false) as HTMLElement;
  const tailRange = document.createRange();
  tailRange.setStart(range.startContainer, range.startOffset);
  tailRange.setEndAfter(choice.lastChild ?? choice);
  const tail = tailRange.extractContents();

  if (Array.from(tail.childNodes).some(hasVisibleContent)) {
    nextChoice.appendChild(tail);
    nextRow.appendChild(nextChoice);
  }

  let sibling = choice.nextSibling;
  while (sibling) {
    const nextSibling = sibling.nextSibling;
    nextRow.appendChild(sibling);
    sibling = nextSibling;
  }

  if (!nextRow.childNodes.length) {
    nextChoice.innerHTML = "<br>";
    nextChoice.classList.add("is-empty-editable-line");
    nextRow.appendChild(nextChoice);
  }

  row.after(nextRow);
  const caretTarget = nextRow.firstElementChild instanceof HTMLElement ? nextRow.firstElementChild : nextRow;
  placeCaretInElement(caretTarget, true);
}

function splitEditableLine(root: HTMLElement, range: Range, line: HTMLElement) {
  const nextLine = line.cloneNode(false) as HTMLElement;
  nextLine.classList.add("is-empty-editable-line");

  const tailRange = document.createRange();
  tailRange.setStart(range.startContainer, range.startOffset);
  tailRange.setEndAfter(line.lastChild ?? line);
  const tail = tailRange.extractContents();

  if (Array.from(tail.childNodes).some(hasVisibleContent)) {
    nextLine.classList.remove("is-empty-editable-line");
    nextLine.appendChild(tail);
  } else {
    nextLine.innerHTML = "<br>";
  }

  line.after(nextLine);
  placeCaretInElement(nextLine, true);
}

function insertEditableLineAfterCurrentSelection(root: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    appendBlankLine(root);
    return;
  }

  const range = selection.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) {
    appendBlankLine(root);
    return;
  }

  if (!range.collapsed) {
    range.deleteContents();
  }

  const node = range.startContainer.nodeType === Node.ELEMENT_NODE ? range.startContainer as Element : range.startContainer.parentElement;
  if (!node) {
    appendBlankLine(root);
    return;
  }

  const choice = node.closest<HTMLElement>(".editable-body-choice");
  const row = node.closest<HTMLElement>(".editable-button-row");
  if (choice && row && root.contains(row)) {
    splitEditableChoice(root, range, choice, row);
    return;
  }

  const line = node.closest<HTMLElement>(".editable-script-line, .editable-muted-label");
  if (line && root.contains(line)) {
    splitEditableLine(root, range, line);
    return;
  }

  const parentRow = node.closest<HTMLElement>(".editable-button-row");
  if (parentRow && root.contains(parentRow)) {
    const nextRow = parentRow.cloneNode(false) as HTMLElement;
    let child: ChildNode | null = parentRow.childNodes[range.startOffset] ?? null;
    while (child) {
      const nextChild: ChildNode | null = child.nextSibling;
      nextRow.appendChild(child);
      child = nextChild;
    }
    if (!nextRow.childNodes.length) nextRow.innerHTML = '<div class="editable-body-choice is-empty-editable-line"><br></div>';
    parentRow.after(nextRow);
    placeCaretInElement(nextRow.firstElementChild instanceof HTMLElement ? nextRow.firstElementChild : nextRow, true);
    return;
  }

  appendBlankLine(root);
}
function normalizeHeadingText(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/[\s:.-]+$/g, "")
    .trim()
    .toLowerCase();
}

function isTitleHeadingText(value: string, title: string) {
  return normalizeHeadingText(value) === normalizeHeadingText(title);
}

function stripLeadingTitleHeadingFromHtml(html: string, title: string) {
  if (!html.trim() || typeof document === "undefined") {
    return html;
  }

  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  const firstElement = Array.from(wrapper.children).find((child) => child.textContent?.trim());

  if (firstElement && isTitleHeadingText(firstElement.textContent ?? "", title)) {
    firstElement.remove();
  }

  return wrapper.innerHTML;
}
function normalizeEmptyParagraphsForDisplay(html: string) {
  if (!html.trim() || typeof document === "undefined") {
    return html;
  }

  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;

  wrapper.querySelectorAll("p, h3").forEach((blockElement) => {
    const isBlank = Array.from(blockElement.childNodes).every((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        return (node.textContent ?? "").replace(/\u00a0/g, "").trim().length === 0;
      }

      if (node instanceof HTMLBRElement) {
        return true;
      }

      return false;
    });

    if (!isBlank) {
      return;
    }

    const spacer = document.createElement("div");
    spacer.className = "tiptap-empty-line";
    spacer.setAttribute("aria-hidden", "true");
    spacer.innerHTML = "&nbsp;";
    blockElement.replaceWith(spacer);
  });

  return wrapper.innerHTML;
}
function renderHtmlWithNames(value: string, names: NameValues) {
  const prospectName = names.prospectName.trim();
  const repName = names.repName.trim();
  const prospect = escapeHtml(prospectName || "Prospect");
  const rep = escapeHtml(repName || "Rep");
  const pp = prospectName ? escapeHtml(prospectName) : "PP";
  const rr = repName ? escapeHtml(repName) : "RR";

  return value
    .replace(/\[\[Prospect\]\]/gi, prospect)
    .replace(/\[\[Rep\]\]/gi, rep)
    .replace(/\bPP\b/g, pp)
    .replace(/\bRR\b/g, rr);
}
function getHighlightableBodyElements(wrapper: HTMLElement, transferTitleTargets: TransferTitleTargets) {
  return Array.from(wrapper.children).filter((element): element is HTMLElement => {
    if (!(element instanceof HTMLElement)) return false;
    if (element.classList.contains("tiptap-empty-line")) return false;
    if (element.matches(".editable-button-stack, .editable-button-row, .editable-body-choice")) return false;

    const text = (element.textContent ?? "").replace(/\u00a0/g, " ").trim();
    if (!text) return false;
    if (transferTitleTargets[text]?.length === 1) return false;

    return element.matches(".editable-script-line, .editable-muted-label, .script-list, p, h3, ul, ol");
  });
}

function getHighlightableBodyCount(html: string, transferTitleTargets: TransferTitleTargets) {
  if (typeof document === "undefined") return 0;

  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  return getHighlightableBodyElements(wrapper, transferTitleTargets).length;
}

function addFlashToBodyElement(html: string, shouldFlash: boolean, highlightIndex: number, transferTitleTargets: TransferTitleTargets) {
  if (!shouldFlash || typeof document === "undefined") {
    return html;
  }

  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  const bodyElements = getHighlightableBodyElements(wrapper, transferTitleTargets);
  const selectedIndex = bodyElements.length > 0 ? Math.max(0, Math.floor(highlightIndex)) % bodyElements.length : 0;
  const targetElement = bodyElements[selectedIndex];

  if (targetElement) {
    targetElement.classList.add("is-flashing");
  }

  return wrapper.innerHTML;
}

function renderEditablePlaceholderToken(label: string) {
  const normalized = label.toLowerCase().includes("rep") || label.toLowerCase().includes("your") || label.toLowerCase().includes("full") ? "Rep" : "Prospect";
  return `<em class="name-token" data-placeholder="${normalized}">${normalized}</em>`;
}

function renderEditableText(value: string) {
  const normalized = normalizeEditorPlaceholders(value);
  return escapeHtml(normalized)
    .replace(/\[\[(Prospect|Rep)\]\]/gi, (_token, label: string) => renderEditablePlaceholderToken(label));
}

function renderEditablePart(part: TextPart) {
  if (part.kind === "strong") {
    return `<strong>${renderEditableText(part.text)}</strong>`;
  }

  if (part.kind === "em" || part.kind === "muted") {
    return `<em class="${part.kind === "muted" ? "script-muted" : ""}">${renderEditableText(part.text)}</em>`;
  }

  if (part.kind === "accent") {
    return `<strong class="script-accent ${part.tone ? `script-accent-${part.tone}` : ""}">${renderEditableText(part.text)}</strong>`;
  }

  if (part.kind === "link") {
    return `<strong class="inline-link ${part.tone ? `inline-link-${part.tone}` : ""}">${renderEditableText(part.label)}</strong>`;
  }

  return renderEditableText(part.text);
}

function renderEditableLine(line: ScriptLine, extraClass = "") {
  const indent = line.indent ?? 0;
  return `<div class="editable-script-line ${extraClass}" style="--indent: ${indent}">${line.parts.map(renderEditablePart).join("") || "<br>"}</div>`;
}

function renderEditableScriptContent(content: ScriptContent, blockTitle: string) {
  if ("items" in content) {
    const indent = content.indent ?? 0;
    const items = content.items.map((item) => `<li>${renderEditableText(item)}</li>`).join("");
    return `<ol class="script-list editable-script-list" style="--indent: ${indent}">${items}</ol>`;
  }

  if (isScriptHeading(content) && isTitleHeadingText(scriptContentToPlainText(content), blockTitle)) {
    return "";
  }

  return renderEditableLine(content);
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
  const bodyHtml = [
    ...(block.lines ?? []).map((line) => renderEditableLine(line)),
    ...(block.mutedLabels ?? []).map((label) => `<div class="muted-label editable-muted-label">${renderEditableText(label)}</div>`),
    ...(block.responseLines ?? []).map((line) => renderEditableLine(line)),
    ...(block.script ?? []).map((content) => renderEditableScriptContent(content, block.title)),
  ].filter(Boolean).join("");
  const rowHtml = buttonRows
    .map((row) => `<div class="editable-button-row">${row.map((button) => `<div class="editable-body-choice ${getChoiceToneClass(button.label, button.target)}"><strong>${renderEditableText(button.label)}</strong></div>`).join("")}</div>`)
    .join("");
  const customHtml = customOptions
    .map((option) => `<div class="editable-button-row"><div class="editable-body-choice ${getChoiceToneClass(option.label, option.target)}"><strong>${renderEditableText(option.label)}</strong></div></div>`)
    .join("");
  const busyHtml = showBusyButton
    ? `<div class="editable-button-row"><div class="editable-body-choice ${getChoiceToneClass(busyLabel, busyTarget)}"><strong>${renderEditableText(busyLabel)}</strong></div></div>`
    : "";
  const choiceHtml = `${rowHtml}${customHtml}${busyHtml}`;

  return `${bodyHtml}${choiceHtml ? `<div class="editable-button-stack">${choiceHtml}</div>` : ""}`;
}
export function DialogueCard({
  block,
  deletedButtonKeys,
  customOptions = [],
  blockOverride,
  isAbsolute = false,
  isEditMode,
  isFlashing,
  isSelected,
  names,
  navigateToBlock,
  onRequestDeleteBlock,
  onStartMoveBlock,
  onUpdateBlockOverride,
  onUpdateOption,
  onSetStarterBlock,
  starterBlockId,
  transferTitleTargets,
  pendingEditDelete,
  onCancelDelete,
  onConfirmDelete,
  position,
  zIndex,
}: {
  block: DialogueBlock;
  customOptions?: CustomOption[];
  blockOverride?: TreeBlockOverrides[string];
  deletedButtonKeys: Set<string>;
  isAbsolute?: boolean;
  isEditMode: boolean;
  isFlashing: boolean;
  isSelected: boolean;
  names: NameValues;
  navigateToBlock: NavigateToBlock;
  onRequestDeleteBlock: (blockId: string) => void;
  onStartMoveBlock: (blockId: string, event: React.PointerEvent<HTMLElement>) => void;
  onUpdateBlockOverride: (blockId: string, override: TreeBlockOverrides[string]) => void;
  onUpdateOption: (blockId: string, optionId: string, label: string) => void;
  onSetStarterBlock: (blockId: string) => void;
  starterBlockId: string;
  transferTitleTargets: TransferTitleTargets;
  pendingEditDelete?: PendingEditDelete;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  position?: { x: number; y: number };
  zIndex?: number;
}) {
  const buttonRows = getButtonRows(block);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const displayTitle = blockOverride?.title ?? block.title;
  const isCustomBlock = block.id.startsWith("custom-");
  const busyTarget = isCustomBlock ? block.id : earlyRushBlockIds.has(block.id) ? "rush" : "rush-bullet";
  const busyLabel = isCustomBlock ? "Potential Transfer Button" : earlyRushBlockIds.has(block.id) ? "Busy" : "Impatient";
  const showBusyButton = !noBusyButtonBlockIds.has(block.id) && !deletedButtonKeys.has(`${block.id}:busy`);
  const overrideBodyHtml = blockOverride?.bodyHtml;
  const editableBodyHtml = stripLeadingTitleHeadingFromHtml(overrideBodyHtml ?? getEditableBodyHtml({ block, buttonRows, customOptions, showBusyButton, busyTarget, busyLabel }), displayTitle);
  const highlightIndex = blockOverride?.highlightIndex ?? 0;
  const transferButtonLabels = Object.keys(transferTitleTargets).filter((label) => transferTitleTargets[label]?.length === 1);
  const [highlightFlash, setHighlightFlash] = useState({ index: highlightIndex, key: 0 });
  const hasScript = block.script && block.script.length > 0;
  const [isStarterConfirmOpen, setIsStarterConfirmOpen] = useState(false);
  const pendingBlockDelete = pendingEditDelete?.type === "block" && pendingEditDelete.id === block.id ? pendingEditDelete : null;
  const hasOpenBlockPopup = Boolean(pendingBlockDelete || isStarterConfirmOpen);
  const positionStyle = isAbsolute
    ? { left: position?.x ?? 0, position: "absolute", top: position?.y ?? 0, zIndex } as React.CSSProperties
    : { transform: `translate(${position?.x ?? 0}px, ${position?.y ?? 0}px)`, zIndex } as React.CSSProperties;

  const requestBlockDelete = () => {
    onRequestDeleteBlock(block.id);
  };

  const cycleHighlightTarget = () => {
    const highlightHtml = normalizeEmptyParagraphsForDisplay(renderHtmlWithNames(editableBodyHtml, names));
    const highlightableCount = getHighlightableBodyCount(highlightHtml, transferTitleTargets);
    const nextHighlightIndex = highlightableCount > 0 ? (highlightIndex + 1) % highlightableCount : 0;
    onUpdateBlockOverride(block.id, { highlightIndex: nextHighlightIndex });
    setHighlightFlash((currentFlash) => ({ index: nextHighlightIndex, key: currentFlash.key + 1 }));


  };
  const handleBodyKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isEditMode || event.key !== "Enter" || event.nativeEvent.isComposing) return;

    event.preventDefault();
    event.stopPropagation();
    insertEditableLineAfterCurrentSelection(event.currentTarget);
    onUpdateBlockOverride(block.id, { bodyHtml: event.currentTarget.innerHTML });
  };

  useEffect(() => {
    if (!isEditMode || !titleRef.current || document.activeElement === titleRef.current) {
      return;
    }

    if (titleRef.current.textContent !== displayTitle) {
      titleRef.current.textContent = displayTitle;
    }
  }, [displayTitle, isEditMode, block.id]);

  useEffect(() => {
    if (!isEditMode || !bodyRef.current || document.activeElement === bodyRef.current) {
      return;
    }

    if (bodyRef.current.innerHTML !== editableBodyHtml) {
      bodyRef.current.innerHTML = editableBodyHtml;
    }
  }, [editableBodyHtml, isEditMode, block.id]);

  const isControlTarget = (target: EventTarget | null) => (
    target instanceof HTMLElement && Boolean(target.closest("button, a, .text-edit-toolbar, .edit-delete-confirm"))
  );

  return (
    <article
      className={`dialogue-block ${hasScript ? "script-block" : "choice-block"} ${!isEditMode && isSelected ? "is-selected" : ""} ${!isEditMode && !isSelected ? "is-muted" : ""} ${isAbsolute ? "is-absolute-block" : ""} ${hasOpenBlockPopup ? "has-inline-popup" : ""}`}
      id={block.id}
      onPointerDown={(event) => {
        pointerStartRef.current = { x: event.clientX, y: event.clientY };

        if (!isEditMode && !isSelected && event.target instanceof HTMLElement && event.target.closest("a.inline-link[data-target-block-id]")) {
          event.preventDefault();
        }

        if (isEditMode && !isControlTarget(event.target)) {
          onStartMoveBlock(block.id, event);
        }
      }}
      onClickCapture={(event) => {
        if (isEditMode || isSelected) return;
        const target = event.target instanceof HTMLElement ? event.target.closest("a.inline-link[data-target-block-id]") : null;
        if (!target) return;

        event.preventDefault();
        event.stopPropagation();
        navigateToBlock(block.id);
      }}
      onPointerUp={(event) => {
        if (isEditMode) return;
        const start = pointerStartRef.current;
        pointerStartRef.current = null;
        if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 4) return;
        if (event.target instanceof HTMLElement && event.target.closest("a.inline-link[data-target-block-id]")) return;
        navigateToBlock(block.id);
      }}
      style={positionStyle}
    >
      {isEditMode ? (
        <EditTextToolbar
          canDelete={true}
          deleteLabel="Delete block"
          onDelete={requestBlockDelete}
          isStarterBlock={block.id === starterBlockId}
          onSetStarterBlock={() => setIsStarterConfirmOpen(true)}
          onCycleHighlight={cycleHighlightTarget}
          showHeadingControl={true}
        />
      ) : null}

      {hasOpenBlockPopup ? (
        <div
          className="edit-card-popup-scrim"
          aria-hidden="true"
          onClick={(event) => { event.stopPropagation(); pendingBlockDelete ? onCancelDelete() : setIsStarterConfirmOpen(false); }}
          onPointerDown={(event) => event.stopPropagation()}
        />
      ) : null}

      {pendingBlockDelete ? (
        <EditDeleteConfirm pendingEditDelete={pendingBlockDelete} onCancel={onCancelDelete} onConfirm={onConfirmDelete} />
      ) : null}

      {isStarterConfirmOpen ? (
        <div className="notepad-confirm edit-delete-confirm" role="alertdialog" aria-label="Set starter block">
          <p>Set this as the starter block?</p>
          <div className="notepad-confirm-actions">
            <button onClick={() => setIsStarterConfirmOpen(false)} type="button">Cancel</button>
            <button onClick={() => { onSetStarterBlock(block.id); setIsStarterConfirmOpen(false); }} type="button">Set Starter</button>
          </div>
        </div>
      ) : null}

      <h2
        ref={titleRef}
        contentEditable={isEditMode}
        data-text-key={`${block.id}:title`}
        onPointerDown={(event) => { if (isEditMode) event.stopPropagation(); }}
        onInput={(event) => onUpdateBlockOverride(block.id, { title: event.currentTarget.textContent ?? "" })}
        suppressContentEditableWarning={true}
      >
        {isEditMode ? null : displayTitle}
      </h2>
      {isEditMode ? (
        <div
          className="block-content"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <TiptapBlockBody
            html={editableBodyHtml}
            isFlashing={isFlashing}
            highlightIndex={highlightFlash.key > 0 ? highlightFlash.index : highlightIndex}
            highlightFlashKey={highlightFlash.key}
            transferButtonLabels={transferButtonLabels}
            onChange={(bodyHtml) => onUpdateBlockOverride(block.id, { bodyHtml })}
          />
        </div>
      ) : (
        <div
          key={`${block.id}-${isEditMode ? "edit" : "view"}-${overrideBodyHtml ? "override" : "default"}`}
          ref={bodyRef}
          className="block-content block-body-editor"
          contentEditable={isEditMode}
          dangerouslySetInnerHTML={isEditMode ? undefined : { __html: addFlashToBodyElement(normalizeEmptyParagraphsForDisplay(linkHtmlWithTransferButtons(renderHtmlWithNames(editableBodyHtml, names), transferTitleTargets)), isFlashing, highlightIndex, transferTitleTargets) }}
          data-text-key={`${block.id}:body`}
          onPointerDown={(event) => { if (isEditMode) event.stopPropagation(); }}
          onClick={(event) => {
            const target = event.target instanceof HTMLElement ? event.target.closest<HTMLAnchorElement>("a.inline-link[data-target-block-id]") : null;
            if (!target) return;
            event.preventDefault();
            event.stopPropagation();
            if (isEditMode) return;
            if (!isSelected) {
              navigateToBlock(block.id);
              return;
            }
            const targetId = target.dataset.targetBlockId;
            if (targetId) navigateToBlock(targetId);
          }}
          onInput={(event) => onUpdateBlockOverride(block.id, { bodyHtml: event.currentTarget.innerHTML })}
          onKeyDown={handleBodyKeyDown}
          suppressContentEditableWarning={true}
        />
      )}

    </article>
  );
}


































































