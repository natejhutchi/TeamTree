import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type { ScriptContent, ScriptLine, TextPart } from "../dialogueTree";
import { EditTextToolbar } from "../editing/EditTextToolbar";
import type { TreePanels } from "../treeData";
import { Icon } from "./Icon";
import { TiptapBlockBody } from "./TiptapBlockBody";
import { type NameValues, type NavigateToBlock } from "./scriptRendering";
import { linkHtmlWithTransferButtons, type TransferTitleTargets } from "./transferRendering";

type ActiveOverlay = "top" | "team" | "bottom" | "objections";
type PanelName = "team" | "objections" | "bottom";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderNameToken(label: string) {
  const normalized = label.toLowerCase().includes("rep") || label.toLowerCase().includes("your") || label.toLowerCase().includes("full") ? "Rep" : "Prospect";
  return `<em class="name-token" data-placeholder="${normalized}">${normalized}</em>`;
}

function renderText(value: string) {
  return escapeHtml(value).replace(/\[\[(?:Your\s+|Prospect\s+|Full\s+)?(Name)\]\]|\[\[(Prospect|Rep)\]\]/gi, (_token, _name, label: string) => renderNameToken(label || _token));
}

function renderPart(part: TextPart) {
  if (part.kind === "strong") return `<strong>${renderText(part.text)}</strong>`;
  if (part.kind === "em" || part.kind === "muted") return `<em class="${part.kind === "muted" ? "script-muted" : ""}">${renderText(part.text)}</em>`;
  if (part.kind === "accent") return `<strong class="script-accent ${part.tone ? `script-accent-${part.tone}` : ""}">${renderText(part.text)}</strong>`;
  if (part.kind === "link") return `<strong class="inline-link ${part.tone ? `inline-link-${part.tone}` : ""}">${renderText(part.label)}</strong>`;
  return renderText(part.text);
}

function renderLine(line: ScriptLine) {
  return `<div class="editable-script-line" style="--indent: ${line.indent ?? 0}">${line.parts.map(renderPart).join("") || "<br>"}</div>`;
}

function renderContent(content: ScriptContent) {
  if ("items" in content) {
    const items = content.items.map((item) => `<li>${renderText(item)}</li>`).join("");
    return `<ol class="script-list editable-script-list" style="--indent: ${content.indent ?? 0}">${items}</ol>`;
  }

  return renderLine(content);
}

function renderResponseHtml(response: ScriptContent[]) {
  return response.map(renderContent).join("");
}

function renderHtmlWithNames(value: string, names: NameValues) {
  const prospectName = names.prospectName.trim();
  const repName = names.repName.trim();
  const prospect = escapeHtml(prospectName || "Prospect");
  const rep = escapeHtml(repName || "Rep");
  const pp = prospectName ? escapeHtml(prospectName) : "PP";
  const rr = repName ? escapeHtml(repName) : "RR";

  return value
    .replace(/<em class="name-token" data-placeholder="Prospect">Prospect<\/em>/gi, `<em class="name-token" data-placeholder="Prospect">${prospect}</em>`)
    .replace(/<em class="name-token" data-placeholder="Rep">Rep<\/em>/gi, `<em class="name-token" data-placeholder="Rep">${rep}</em>`)
    .replace(/\[\[Prospect\]\]/gi, prospect)
    .replace(/\[\[Rep\]\]/gi, rep)
    .replace(/\bPP\b/g, pp)
    .replace(/\bRR\b/g, rr);
}

function EditablePanelContent({
  defaultHtml,
  isEditMode,
  names,
  navigateToBlock,
  onUpdate,
  overrideHtml,
  transferTitleTargets,
  singleLineLimit = false,
  cappedBlockLimit = false,
}: {
  defaultHtml: string;
  isEditMode: boolean;
  names: NameValues;
  navigateToBlock: NavigateToBlock;
  onUpdate: (html: string) => void;
  overrideHtml?: string;
  transferTitleTargets: TransferTitleTargets;
  singleLineLimit?: boolean;
  cappedBlockLimit?: boolean;
}) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const editableHtml = overrideHtml ?? defaultHtml;
  const lastValidHtmlRef = useRef(editableHtml);
  const inputSnapshotHtmlRef = useRef(editableHtml);

  useEffect(() => {
    if (!isEditMode || !contentRef.current || document.activeElement === contentRef.current) return;
    if (contentRef.current.innerHTML !== editableHtml) {
      contentRef.current.innerHTML = editableHtml;
    }
    if ((!singleLineLimit && !cappedBlockLimit) || !isOverflowing(contentRef.current)) {
      lastValidHtmlRef.current = editableHtml;
    }
  }, [editableHtml, isEditMode, singleLineLimit, cappedBlockLimit]);

  function isOverflowing(element: HTMLDivElement) {
    return element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1;
  }

  function getNodePath(root: Node, node: Node) {
    const path: number[] = [];
    let current: Node | null = node;

    while (current && current !== root) {
      const parent: ParentNode | null = current.parentNode;
      if (!parent) return null;
      path.unshift(Array.prototype.indexOf.call(parent.childNodes, current));
      current = parent;
    }

    return current === root ? path : null;
  }

  function getNodeFromPath(root: Node, path: number[]) {
    let current = root;

    for (const index of path) {
      const next = current.childNodes[index];
      if (!next) return null;
      current = next;
    }

    return current;
  }

  function createInputPreview(element: HTMLDivElement, inputType: string, data: string | null) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    if (!element.contains(range.commonAncestorContainer)) return null;

    const startPath = getNodePath(element, range.startContainer);
    const endPath = getNodePath(element, range.endContainer);
    if (!startPath || !endPath) return null;

    const clone = element.cloneNode(true) as HTMLDivElement;
    const startNode = getNodeFromPath(clone, startPath);
    const endNode = getNodeFromPath(clone, endPath);
    if (!startNode || !endNode) return null;

    const previewRange = document.createRange();
    const startLimit = startNode.nodeType === Node.TEXT_NODE ? startNode.textContent?.length ?? 0 : startNode.childNodes.length;
    const endLimit = endNode.nodeType === Node.TEXT_NODE ? endNode.textContent?.length ?? 0 : endNode.childNodes.length;
    previewRange.setStart(startNode, Math.min(range.startOffset, startLimit));
    previewRange.setEnd(endNode, Math.min(range.endOffset, endLimit));
    previewRange.deleteContents();

    if (inputType === "insertParagraph" || inputType === "insertLineBreak") {
      previewRange.insertNode(document.createElement("br"));
    } else {
      previewRange.insertNode(document.createTextNode(data ?? ""));
    }

    clone.style.position = "fixed";
    clone.style.left = "-10000px";
    clone.style.top = "-10000px";
    clone.style.width = `${element.clientWidth}px`;
    clone.style.height = `${element.clientHeight}px`;
    clone.style.maxHeight = `${element.clientHeight}px`;
    clone.style.visibility = "hidden";
    clone.style.pointerEvents = "none";
    clone.style.overflow = "hidden";

    return clone;
  }


  function countRenderedTextLines(element: HTMLElement) {
    const tops = new Set<number>();
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();

    while (node) {
      if (node.textContent?.trim()) {
        const range = document.createRange();
        range.selectNodeContents(node);
        Array.from(range.getClientRects()).forEach((rect) => {
          if (rect.width > 0 && rect.height > 0) {
            tops.add(Math.round(rect.top));
          }
        });
        range.detach();
      }
      node = walker.nextNode();
    }

    return tops.size;
  }
  function canAcceptInput(element: HTMLDivElement, inputType: string, data: string | null) {
    if (inputType.startsWith("delete") || inputType.startsWith("history") || inputType.startsWith("format")) return true;
    if (!inputType.startsWith("insert")) return true;
    if (singleLineLimit && (inputType === "insertParagraph" || inputType === "insertLineBreak")) return false;

    const preview = createInputPreview(element, inputType, data);
    if (!preview) return true;

    document.body.appendChild(preview);
    const fits = !isOverflowing(preview);
    preview.remove();

    return fits;
  }
  const viewHtml = linkHtmlWithTransferButtons(renderHtmlWithNames(editableHtml, names), transferTitleTargets);

  return (
    <div
      ref={contentRef}
      className={isEditMode ? `panel-body-editor${cappedBlockLimit ? " is-capped-editor" : ""}` : ""}
      contentEditable={isEditMode}
      dangerouslySetInnerHTML={isEditMode ? undefined : { __html: viewHtml }}
      onClick={(event) => {
        const target = event.target instanceof HTMLElement ? event.target.closest<HTMLAnchorElement>("a.inline-link[data-target-block-id]") : null;
        if (!target) return;
        event.preventDefault();
        event.stopPropagation();
        if (isEditMode) return;
        const targetId = target.dataset.targetBlockId;
        if (targetId) navigateToBlock(targetId);
      }}
      onBeforeInput={(event) => {
        if (!singleLineLimit && !cappedBlockLimit) return;
        const nativeEvent = event.nativeEvent as InputEvent & { dataTransfer?: DataTransfer | null };
        const inputType = nativeEvent.inputType;
        const data = nativeEvent.data ?? nativeEvent.dataTransfer?.getData("text/plain") ?? "";

        if (!canAcceptInput(event.currentTarget, inputType, data)) {
          event.preventDefault();
        }
      }}
      onInput={(event) => {
        lastValidHtmlRef.current = event.currentTarget.innerHTML;
        onUpdate(event.currentTarget.innerHTML);
      }}
      onKeyUp={(event) => {
        lastValidHtmlRef.current = event.currentTarget.innerHTML;
        onUpdate(event.currentTarget.innerHTML);
      }}
      onMouseUp={(event) => {
        lastValidHtmlRef.current = event.currentTarget.innerHTML;
        onUpdate(event.currentTarget.innerHTML);
      }}
      suppressContentEditableWarning={true}
    />
  );
}

function EditableTiptapPanelContent({
  defaultHtml,
  isEditMode,
  names,
  navigateToBlock,
  onUpdate,
  overrideHtml,
  transferTitleTargets,
}: {
  defaultHtml: string;
  isEditMode: boolean;
  names: NameValues;
  navigateToBlock: NavigateToBlock;
  onUpdate: (html: string) => void;
  overrideHtml?: string;
  transferTitleTargets: TransferTitleTargets;
}) {
  const editableHtml = overrideHtml ?? defaultHtml;
  const viewHtml = linkHtmlWithTransferButtons(renderHtmlWithNames(editableHtml, names), transferTitleTargets);

  if (isEditMode) {
    return (
      <TiptapBlockBody
        editorClassName="tiptap-panel-editor panel-body-editor"
        html={editableHtml}
        onChange={onUpdate}
      />
    );
  }

  return (
    <div
      className="tiptap-panel-editor panel-body-editor"
      dangerouslySetInnerHTML={{ __html: viewHtml }}
      onClick={(event) => {
        const target = event.target instanceof HTMLElement ? event.target.closest<HTMLAnchorElement>("a.inline-link[data-target-block-id]") : null;
        if (!target) return;
        event.preventDefault();
        event.stopPropagation();
        const targetId = target.dataset.targetBlockId;
        if (targetId) navigateToBlock(targetId);
      }}
    />
  );
}
function PanelToolbar({ className, showHeadingControl = false }: { className: string; showHeadingControl?: boolean }) {
  return (
    <div className={`panel-edit-toolbar ${className}`}>
      <EditTextToolbar canDelete={false} deleteLabel="Delete panel text" onDelete={() => undefined} showHeadingControl={showHeadingControl} />
    </div>
  );
}

export function InfoPanels({
  activeOverlay,
  isEditMode,
  isObjectionsOpen,
  isTeamInfoOpen,
  isTopInfoOpen,
  names,
  navigateToBlock,
  objectionResponses,
  onUpdatePanel,
  panels,
  setActiveOverlay,
  setIsObjectionsOpen,
  setIsTeamInfoOpen,
  setIsTopInfoOpen,
  sideInfoResponses,
  topInfoResponses,
  transferTitleTargets,
}: {
  activeOverlay: ActiveOverlay;
  isEditMode: boolean;
  isObjectionsOpen: boolean;
  isTeamInfoOpen: boolean;
  isTopInfoOpen: boolean;
  names: NameValues;
  navigateToBlock: NavigateToBlock;
  objectionResponses: ScriptContent[][];
  onUpdatePanel: (panel: keyof TreePanels, key: string, html: string) => void;
  panels: TreePanels;
  setActiveOverlay: Dispatch<SetStateAction<ActiveOverlay>>;
  setIsObjectionsOpen: Dispatch<SetStateAction<boolean>>;
  setIsTeamInfoOpen: Dispatch<SetStateAction<boolean>>;
  setIsTopInfoOpen: Dispatch<SetStateAction<boolean>>;
  sideInfoResponses: ScriptContent[][];
  topInfoResponses: ScriptContent[][];
  transferTitleTargets: TransferTitleTargets;
}) {
  const renderPanelSection = (panel: PanelName, response: ScriptContent[], responseIndex: number) => {
    const key = String(responseIndex);
    const className = panel === "team" ? "team-info-response" : panel === "objections" ? "objection-response" : "bottom-info-card";

    if (panel === "bottom") {
      const titleKey = `${key}:title`;
      const bodyKey = `${key}:body`;
      const defaultHtml = renderResponseHtml(response);
      const legacyTitleHtml = panels.bottom?.[titleKey];
      const legacyBodyHtml = panels.bottom?.[bodyKey];
      const overrideHtml = panels.bottom?.[key] ?? (legacyTitleHtml || legacyBodyHtml ? `${legacyTitleHtml ?? ""}${legacyBodyHtml ?? ""}` : undefined);

      return (
        <section className={className} key={`${panel}-${responseIndex}`}>
          <EditableTiptapPanelContent
            defaultHtml={defaultHtml}
            isEditMode={isEditMode}
            names={names}
            navigateToBlock={navigateToBlock}
            onUpdate={(html) => onUpdatePanel(panel, key, html)}
            overrideHtml={overrideHtml}
            transferTitleTargets={transferTitleTargets}
          />
        </section>
      );
    }

    return (
      <section className={className} key={`${panel}-${responseIndex}`}>
        <EditableTiptapPanelContent
          defaultHtml={renderResponseHtml(response)}
          isEditMode={isEditMode}
          names={names}
          navigateToBlock={navigateToBlock}
          onUpdate={(html) => onUpdatePanel(panel, key, html)}
          overrideHtml={panels[panel]?.[key]}
          transferTitleTargets={transferTitleTargets}
        />
      </section>
    );
  };
  function getCombinedPanelOverride(panel: "team" | "objections") {
    const panelValues = panels[panel];
    if (!panelValues) return undefined;
    if (typeof panelValues.content === "string") return panelValues.content;

    const sectionKeys = Object.keys(panelValues)
      .filter((key) => /^\d+$/.test(key))
      .sort((left, right) => Number(left) - Number(right));

    return sectionKeys.length ? sectionKeys.map((key) => panelValues[key]).join("<p></p>") : undefined;
  }

  function renderSidePanelContent(panel: "team" | "objections", responses: ScriptContent[][]) {
    return (
      <EditableTiptapPanelContent
        defaultHtml={responses.map((response) => renderResponseHtml(response)).join("<p></p>")}
        isEditMode={isEditMode}
        names={names}
        navigateToBlock={navigateToBlock}
        onUpdate={(html) => onUpdatePanel(panel, "content", html)}
        overrideHtml={getCombinedPanelOverride(panel)}
        transferTitleTargets={transferTitleTargets}
      />
    );
  }


  return (
    <>
      <aside className={`team-info-sidebar ${isTeamInfoOpen ? "is-open" : ""} ${activeOverlay === "team" ? "is-front" : ""}`} aria-label="Team information">
        <button
          className="team-info-toggle"
          aria-label={isTeamInfoOpen ? "Collapse team information" : "Expand team information"}
          onClick={() => {
            if (!isTeamInfoOpen) setActiveOverlay("team");
            setIsTeamInfoOpen((isOpen) => !isOpen);
          }}
          type="button"
        >
          <Icon name="badge" />
        </button>
        {isEditMode ? <PanelToolbar className="team-info-edit-toolbar" showHeadingControl={true} /> : null}
        <div className="team-info-panel">
          {renderSidePanelContent("team", sideInfoResponses)}
        </div>
      </aside>

      <aside className={`bottom-info-bar ${isTopInfoOpen ? "is-open" : ""} ${activeOverlay === "bottom" ? "is-front" : ""}`} aria-label="Team model information">
        {isEditMode ? <PanelToolbar className="bottom-info-edit-toolbar" showHeadingControl={true} /> : null}
        <div className="bottom-info-panel">
          <div className="bottom-info-grid">
            {topInfoResponses.map((response, responseIndex) => renderPanelSection("bottom", response, responseIndex))}
          </div>
        </div>
        <button
          className="bottom-info-toggle"
          aria-label={isTopInfoOpen ? "Collapse team model information" : "Expand team model information"}
          onClick={() => {
            if (!isTopInfoOpen) setActiveOverlay("bottom");
            setIsTopInfoOpen((isOpen) => !isOpen);
          }}
          type="button"
        >
          <Icon name="badge" />
        </button>
      </aside>

      <aside className={`objection-sidebar ${isObjectionsOpen ? "is-open" : ""} ${activeOverlay === "objections" ? "is-front" : ""}`} aria-label="Objection responses">
        <button
          className="objection-toggle"
          aria-label={isObjectionsOpen ? "Collapse objection responses" : "Expand objection responses"}
          onClick={() => {
            if (!isObjectionsOpen) setActiveOverlay("objections");
            setIsObjectionsOpen((isOpen) => !isOpen);
          }}
          type="button"
        >
          <Icon name="badge" />
        </button>
        {isEditMode ? <PanelToolbar className="objection-edit-toolbar" showHeadingControl={true} /> : null}
        <div className="objection-panel">
          {renderSidePanelContent("objections", objectionResponses)}
        </div>
      </aside>
    </>
  );
}





























