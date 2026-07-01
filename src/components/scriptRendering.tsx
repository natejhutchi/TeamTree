import type React from "react";
import type { ScriptContent, ScriptLine, TextPart } from "../dialogueTree";

export type NavigateToBlock = (id: string, options?: { trackHistory?: boolean }) => void;
export type NameValues = { prospectName: string; repName: string };

type SelectTextHandler = (textKey: string | null) => void;

function resolveNameToken(label: string, value: string, tokenIndex: number, names: NameValues) {
  const prospectName = names.prospectName.trim() || "Prospect";
  const repName = names.repName.trim() || "Rep";
  const normalizedLabel = label.toLowerCase();

  if (normalizedLabel.includes("prospect")) {
    return prospectName;
  }

  if (normalizedLabel.includes("rep")) {
    return repName;
  }

  if (normalizedLabel.includes("your") || normalizedLabel.includes("full")) {
    return repName;
  }

  if (value.includes("it's") && value.match(/\[\[Name\]\]/g)?.length === 2) {
    return tokenIndex === 1 ? repName : prospectName;
  }

  if (value.includes("from TeamTown")) {
    return repName;
  }

  return prospectName;
}

function renderTextWithNameTokens(value: string, keyPrefix: number, names: NameValues) {
  let tokenCount = 0;
  const prospectName = names.prospectName.trim();
  const repName = names.repName.trim();

  return value.split(/(\[\[(?:Your\s+|Prospect\s+|Full\s+)?Name\]\]|\[\[(?:Prospect|Rep)\]\]|\bPP\b|\bRR\b)/gi).map((part, tokenIndex) => {
    const match = part.match(/^\[\[(.*?)\]\]$/);

    if (match && /(name|prospect|rep)/i.test(match[1])) {
      const resolvedName = resolveNameToken(match[1], value, tokenCount, names);
      tokenCount += 1;

      return (
        <em className="name-token" key={`${keyPrefix}-name-${tokenIndex}`}>
          {resolvedName}
        </em>
      );
    }

    if (part === "PP" && prospectName) {
      return <span key={`${keyPrefix}-pp-${tokenIndex}`}>{prospectName}</span>;
    }

    if (part === "RR" && repName) {
      return <span key={`${keyPrefix}-rr-${tokenIndex}`}>{repName}</span>;
    }

    return <span key={`${keyPrefix}-text-${tokenIndex}`}>{part}</span>;
  });
}

function ScriptPart({
  index,
  isBlockSelected = true,
  isEditMode = false,
  names,
  navigateToBlock,
  part,
}: {
  index: number;
  isBlockSelected?: boolean;
  isEditMode?: boolean;
  names: NameValues;
  navigateToBlock: NavigateToBlock;
  part: TextPart;
}) {
  if (part.kind === "strong") {
    return <strong key={index}>{part.text}</strong>;
  }

  if (part.kind === "em") {
    return <em key={index}>{renderTextWithNameTokens(part.text, index, names)}</em>;
  }

  if (part.kind === "muted") {
    return <em className="script-muted" key={index}>{renderTextWithNameTokens(part.text, index, names)}</em>;
  }

  if (part.kind === "accent") {
    return (
      <strong className={`script-accent ${part.tone ? `script-accent-${part.tone}` : ""}`} key={index}>
        {part.text}
      </strong>
    );
  }

  if (part.kind === "link") {
    return (
      <a
        className={`inline-link ${part.tone ? `inline-link-${part.tone}` : ""}`}
        data-target-block-id={part.target}
        href=""
        key={index}
        onClick={(event) => {
          event.preventDefault();

          if (isEditMode) {
            event.stopPropagation();
            return;
          }

          event.stopPropagation();
          navigateToBlock(part.target);
        }}
      >
        {part.label}
      </a>
    );
  }

  return <span key={index}>{renderTextWithNameTokens(part.text, index, names)}</span>;
}

export function getScriptOptionLabel(line: ScriptLine) {
  const linkPart = line.parts.find((part) => part.kind === "link");

  if (linkPart?.kind === "link") {
    return linkPart.label;
  }

  return line.parts.map((part) => {
    if ("text" in part) {
      return part.text;
    }

    if ("label" in part) {
      return part.label;
    }

    return "";
  }).join("").trim() || "text";
}

export function ScriptLineView({
  deleteKey,
  editingTextKey,
  isBlockSelected = true,
  isEditMode = false,
  isFlashing = false,
  line,
  names,
  navigateToBlock,
  onSelectText,
  selectedTextKey,
}: {
  deleteKey?: string;
  editingTextKey?: string | null;
  isBlockSelected?: boolean;
  isEditMode?: boolean;
  isFlashing?: boolean;
  line: ScriptLine;
  names: NameValues;
  navigateToBlock: NavigateToBlock;
  onSelectText?: SelectTextHandler;
  selectedTextKey?: string | null;
}) {
  const isTextEditing = isEditMode && editingTextKey === deleteKey;

  return (
    <p
      className={`script-line ${isFlashing ? "is-flashing" : ""} ${selectedTextKey === deleteKey ? "is-text-selected" : ""}`}
      contentEditable={isTextEditing}
      data-text-key={deleteKey}
      onClick={(event) => { if (!isEditMode) return; event.stopPropagation(); onSelectText?.(deleteKey ?? null); }}
      suppressContentEditableWarning={true}
      style={{ "--indent": line.indent ?? 0 } as React.CSSProperties}
    >
      {line.parts.map((part, index) => (
        <ScriptPart index={index} isBlockSelected={isBlockSelected} isEditMode={isEditMode} key={index} names={names} navigateToBlock={navigateToBlock} part={part} />
      ))}
    </p>
  );
}

export function ScriptContentView({
  content,
  deleteKey,
  editingTextKey,
  isBlockSelected = true,
  isEditMode = false,
  isFlashing = false,
  names,
  navigateToBlock,
  onSelectText,
  selectedTextKey,
}: {
  content: ScriptContent;
  deleteKey?: string;
  editingTextKey?: string | null;
  isBlockSelected?: boolean;
  isEditMode?: boolean;
  isFlashing?: boolean;
  names: NameValues;
  navigateToBlock: NavigateToBlock;
  onSelectText?: SelectTextHandler;
  selectedTextKey?: string | null;
}) {
  if ("items" in content) {
    return (
      <ol className="script-list" style={{ "--indent": content.indent ?? 0 } as React.CSSProperties}>
        {content.items.map((item, index) => {
          const itemKey = deleteKey ? `${deleteKey}:item:${index}` : undefined;

          return (
            <li key={item}>
              <span
                className={selectedTextKey === itemKey ? "is-text-selected" : ""}
                contentEditable={isEditMode && editingTextKey === itemKey}
                data-text-key={itemKey}
                onClick={(event) => { if (!isEditMode) return; event.stopPropagation(); onSelectText?.(itemKey ?? null); }}
                suppressContentEditableWarning={true}
              >
                {item}
              </span>
            </li>
          );
        })}
      </ol>
    );
  }

  return <ScriptLineView deleteKey={deleteKey} editingTextKey={editingTextKey} isBlockSelected={isBlockSelected} isEditMode={isEditMode} isFlashing={isFlashing} line={content} names={names} navigateToBlock={navigateToBlock} onSelectText={onSelectText} selectedTextKey={selectedTextKey} />;
}
export function isScriptHeading(content: ScriptContent) {
  return "parts" in content && content.parts.length === 1 && ["strong", "accent"].includes(content.parts[0].kind);
}







