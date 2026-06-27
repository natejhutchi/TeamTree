import { useEffect, useState } from "react";
import type { NavigateToBlock } from "./scriptRendering";
import { getCanvasScroller, getVisibleCanvasCenter } from "./useCanvasViewport";

function scrollToBlock(id: string) {
  const target = document.getElementById(id);
  const scroller = getCanvasScroller();

  if (!target || !scroller) {
    return;
  }

  const targetRect = target.getBoundingClientRect();
  const scrollerRect = scroller.getBoundingClientRect();
  const visibleCenter = getVisibleCanvasCenter(scrollerRect);
  const targetCenterX = targetRect.left + targetRect.width / 2;
  const targetCenterY = targetRect.top + targetRect.height / 2;
  let scrollTopDelta = targetCenterY - visibleCenter.y;
  const predictedTargetTop = targetRect.top - scrollTopDelta;

  if (predictedTargetTop < visibleCenter.topClearance) {
    scrollTopDelta += predictedTargetTop - visibleCenter.topClearance;
  }

  scroller.scrollBy({
    behavior: "smooth",
    left: targetCenterX - visibleCenter.x,
    top: scrollTopDelta,
  });
}

export function scrollToTextKey(textKey: string) {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      const target = Array.from(document.querySelectorAll<HTMLElement>("[data-text-key]")).find((item) => item.dataset.textKey === textKey);

      target?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    });
  });
}

export function useCanvasNavigation({ isEditModeRef }: { isEditModeRef: { current: boolean } }) {
  const [selectedBlockId, setSelectedBlockId] = useState(() => window.location.hash.slice(1) || "start");
  const [flashingBlockId, setFlashingBlockId] = useState<string | null>(null);
  const [blockHistory, setBlockHistory] = useState([window.location.hash.slice(1) || "start"]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const canUndo = historyIndex > 0;

  const navigateToBlock: NavigateToBlock = (id, options = {}) => {
    const { trackHistory = true, updateHash = true } = options;

    if (updateHash) {
      history.pushState(null, "", `#${id}`);
    }

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
    requestAnimationFrame(() => setFlashingBlockId(id));
    scrollToBlock(id);
  };

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

  useEffect(() => {
    const scrollToCurrentHash = () => {
      const id = window.location.hash.slice(1);

      if (id) {
        navigateToBlock(id, { trackHistory: false, updateHash: false });
      }
    };

    scrollToCurrentHash();
    window.addEventListener("hashchange", scrollToCurrentHash);

    return () => window.removeEventListener("hashchange", scrollToCurrentHash);
  }, []);

  useEffect(() => {
    if (isEditModeRef.current) {
      return;
    }

    let frame = 0;

    const updateCenteredBlock = () => {
      if (isEditModeRef.current) {
        return;
      }

      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const scroller = getCanvasScroller();
        const scrollerRect = scroller?.getBoundingClientRect();
        const visibleCenter = scrollerRect ? getVisibleCanvasCenter(scrollerRect) : null;
        const viewportCenterX = visibleCenter ? visibleCenter.x : window.innerWidth / 2;
        const viewportCenterY = visibleCenter ? visibleCenter.y : window.innerHeight / 2;
        let closestId = selectedBlockId;
        let closestDistance = Number.POSITIVE_INFINITY;

        document.querySelectorAll<HTMLElement>(".dialogue-block").forEach((block) => {
          const rect = block.getBoundingClientRect();
          const blockCenterX = rect.left + rect.width / 2;
          const blockCenterY = rect.top + rect.height / 2;
          const distance = Math.hypot(blockCenterX - viewportCenterX, blockCenterY - viewportCenterY);

          if (distance < closestDistance) {
            closestDistance = distance;
            closestId = block.id;
          }
        });

        setSelectedBlockId(closestId);
      });
    };

    const scroller = getCanvasScroller();

    updateCenteredBlock();
    scroller?.addEventListener("scroll", updateCenteredBlock, { passive: true });
    window.addEventListener("resize", updateCenteredBlock);

    return () => {
      cancelAnimationFrame(frame);
      scroller?.removeEventListener("scroll", updateCenteredBlock);
      window.removeEventListener("resize", updateCenteredBlock);
    };
  }, [selectedBlockId, isEditModeRef]);

  return {
    canUndo,
    flashingBlockId,
    goToHistoryIndex,
    historyIndex,
    navigateToBlock,
    scrollToTextKey,
    selectedBlockId,
    setFlashingBlockId,
    setSelectedBlockId,
  };
}