import { useCallback, useEffect, useState } from "react";
import type { NavigateToBlock } from "./scriptRendering";

export function useCanvasNavigation({ centerBlock, centerTextKey }: { centerBlock: (id: string, behavior?: ScrollBehavior) => void; centerTextKey: (textKey: string) => void }) {
  const [selectedBlockId, setSelectedBlockId] = useState("start");
  const [flashingBlockId, setFlashingBlockId] = useState<string | null>(null);
  const [blockHistory, setBlockHistory] = useState(["start"]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const canUndo = historyIndex > 0;

  const navigateToBlock: NavigateToBlock = useCallback((id, options = {}) => {
    const { trackHistory = true } = options;

    if (trackHistory) {
      setBlockHistory((currentHistory) => {
        const trimmedHistory = currentHistory.slice(0, historyIndex + 1);

        if (trimmedHistory[trimmedHistory.length - 1] === id) {
          return trimmedHistory;
        }

        const nextHistory = [...trimmedHistory, id];
        setHistoryIndex(nextHistory.length - 1);
        return nextHistory;
      });
    }

    setSelectedBlockId(id);
    setFlashingBlockId(null);
    window.requestAnimationFrame(() => setFlashingBlockId(id));
    centerBlock(id);
  }, [centerBlock, historyIndex]);

  const goToHistoryIndex = (nextIndex: number) => {
    const targetId = blockHistory[nextIndex];

    if (!targetId) {
      return;
    }

    setHistoryIndex(nextIndex);
    navigateToBlock(targetId, { trackHistory: false });
  };

  useEffect(() => {
    if (!flashingBlockId) {
      return;
    }

    const timeout = window.setTimeout(() => setFlashingBlockId(null), 5000);

    return () => window.clearTimeout(timeout);
  }, [flashingBlockId]);

  return {
    canUndo,
    flashingBlockId,
    goToHistoryIndex,
    historyIndex,
    navigateToBlock,
    scrollToTextKey: centerTextKey,
    selectedBlockId,
    setFlashingBlockId,
    setSelectedBlockId,
  };
}