import { useState } from "react";

export function useModalTransition(durationMs: number) {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  function open() {
    setIsClosing(false);
    setIsOpen(true);
  }

  function close(onClosed?: () => void) {
    if (isClosing) return;

    setIsClosing(true);
    window.setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
      onClosed?.();
    }, durationMs);
  }

  return { close, isClosing, isOpen, open };
}