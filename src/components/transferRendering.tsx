import type { ReactNode } from "react";
import type { NavigateToBlock } from "./scriptRendering";

export type TransferTitleTargets = Record<string, string[]>;

function getTransferMatches(transferTitleTargets: TransferTitleTargets) {
  return Object.entries(transferTitleTargets)
    .filter(([title, ids]) => title.length > 0 && ids.length === 1)
    .sort(([a], [b]) => b.length - a.length);
}

function getTransferToneClass(title: string) {
  const normalizedTitle = title.trim().toLowerCase();

  if (normalizedTitle === "solution") {
    return "inline-link-solution";
  }

  if (normalizedTitle === "exit" || normalizedTitle === "graceful exit") {
    return "inline-link-exit";
  }

  if (normalizedTitle === "close") {
    return "inline-link-close";
  }

  if (normalizedTitle === "busy" || normalizedTitle === "impatient" || normalizedTitle === "busy / impatient") {
    return "inline-link-busy";
  }

  return "inline-link-reference";
}

export function renderTextWithTransferButtons({
  isBlockSelected,
  isEditMode,
  keyPrefix,
  navigateToBlock,
  transferTitleTargets,
  value,
}: {
  isBlockSelected: boolean;
  isEditMode: boolean;
  keyPrefix: string | number;
  navigateToBlock: NavigateToBlock;
  transferTitleTargets: TransferTitleTargets;
  value: string;
}): ReactNode[] {
  const matches = getTransferMatches(transferTitleTargets);
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let nodeIndex = 0;

  while (cursor < value.length) {
    const match = matches.find(([title]) => value.startsWith(title, cursor));

    if (!match) {
      const nextMatchIndex = matches.reduce((nearest, [title]) => {
        const nextIndex = value.indexOf(title, cursor + 1);
        return nextIndex === -1 ? nearest : Math.min(nearest, nextIndex);
      }, value.length);
      const textValue = value.slice(cursor, nextMatchIndex);
      nodes.push(<span key={`${keyPrefix}-text-${nodeIndex}`}>{textValue}</span>);
      cursor = nextMatchIndex;
      nodeIndex += 1;
      continue;
    }

    const [title, ids] = match;
    const target = ids[0];
    nodes.push(
      <a
        className={`inline-link ${getTransferToneClass(title)}`}
        data-target-block-id={target}
        href=""
        key={`${keyPrefix}-transfer-${nodeIndex}`}
        onClick={(event) => {
          event.preventDefault();

          if (isEditMode) {
            event.stopPropagation();
            return;
          }
          event.stopPropagation();
          navigateToBlock(target);
        }}
      >
        {title}
      </a>,
    );
    cursor += title.length;
    nodeIndex += 1;
  }

  return nodes;
}

export function linkHtmlWithTransferButtons(html: string, transferTitleTargets: TransferTitleTargets) {
  if (typeof document === "undefined") {
    return html;
  }

  const matches = getTransferMatches(transferTitleTargets);
  if (matches.length === 0) {
    return html;
  }

  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;

  function getExplicitTextColor(element: HTMLElement | null) {
    let current: HTMLElement | null = element;

    while (current && current !== wrapper) {
      const color = current.style.color;
      if (color) {
        return color;
      }
      current = current.parentElement;
    }

    return "";
  }
  const walker = document.createTreeWalker(wrapper, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const parent = node.parentElement;

    if (!parent || parent.closest("a")) {
      continue;
    }

    textNodes.push(node);
  }

  textNodes.forEach((node) => {
    const value = node.nodeValue ?? "";
    const fragment = document.createDocumentFragment();
    let cursor = 0;

    while (cursor < value.length) {
      const match = matches.find(([title]) => value.startsWith(title, cursor));

      if (!match) {
        const nextMatchIndex = matches.reduce((nearest, [title]) => {
          const nextIndex = value.indexOf(title, cursor + 1);
          return nextIndex === -1 ? nearest : Math.min(nearest, nextIndex);
        }, value.length);
        fragment.append(document.createTextNode(value.slice(cursor, nextMatchIndex)));
        cursor = nextMatchIndex;
        continue;
      }

      const [title, ids] = match;
      const anchor = document.createElement("a");
      anchor.className = `inline-link ${getTransferToneClass(title)}`;
      anchor.dataset.targetBlockId = ids[0];
      anchor.href = "";
      const explicitColor = getExplicitTextColor(node.parentElement);
      if (explicitColor) {
        anchor.style.color = explicitColor;
      }
      anchor.textContent = title;
      fragment.append(anchor);
      cursor += title.length;
    }

    node.replaceWith(fragment);
  });

  return wrapper.innerHTML;
}

