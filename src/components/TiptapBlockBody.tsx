import { useEffect } from "react";
import { Extension } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";

type TiptapToolbarCommand = {
  command: string;
  value?: string;
};

let lastActiveTiptapEditor: any = null;

function dispatchTiptapHistoryState(editor: any) {
  window.dispatchEvent(new CustomEvent("teamtown:tiptap-history-state", {
    detail: {
      canUndo: Boolean(editor.can().undo()),
      canRedo: Boolean(editor.can().redo()),
    },
  }));
}

function getHighlightableEditorElements(editorRoot: HTMLElement, transferButtonLabels: string[]) {
  const transferButtonLabelSet = new Set(transferButtonLabels);

  return Array.from(editorRoot.children).filter((element): element is HTMLElement => {
    if (!(element instanceof HTMLElement)) return false;

    const text = (element.textContent ?? "").replace(/\u00a0/g, " ").trim();
    if (!text) return false;
    if (transferButtonLabelSet.has(text)) return false;

    return element.matches("p, h1, h2, h3, h4, h5, h6, ul, ol");
  });
}

function flashHighlightElement(element: HTMLElement) {
  element.classList.remove("is-flashing", "is-highlight-preview");
  void element.offsetWidth;
  element.classList.add("is-flashing", "is-highlight-preview");
}
const TiptapIndent = Extension.create({
  name: "teamTownIndent",

  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element: HTMLElement) => Number.parseInt(element.getAttribute("data-indent") ?? "0", 10) || 0,
            renderHTML: (attributes: { indent?: number }) => {
              const indent = Number(attributes.indent ?? 0);
              return indent > 0
                ? { "data-indent": String(indent), style: `padding-left: ${indent * 48}px` }
                : {};
            },
          },
        },
      },
      {
        types: ["listItem"],
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element: HTMLElement) => Number.parseInt(element.getAttribute("data-indent") ?? "0", 10) || 0,
            renderHTML: (attributes: { indent?: number }) => {
              const indent = Number(attributes.indent ?? 0);
              return indent > 0
                ? { "data-indent": String(indent), style: `margin-left: ${indent * 48}px` }
                : {};
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      increaseIndent: () => ({ editor, commands }: { editor: any; commands: any }) => {
        if (editor.isActive("listItem")) {
          const listItemIndent = Number(editor.getAttributes("listItem").indent ?? 0);
          return commands.updateAttributes("listItem", { indent: Math.min(8, listItemIndent + 1) });
        }

        const paragraphIndent = Number(editor.getAttributes("paragraph").indent ?? 0);
        const headingIndent = Number(editor.getAttributes("heading").indent ?? 0);
        const nextIndent = Math.min(8, Math.max(paragraphIndent, headingIndent) + 1);
        return commands.updateAttributes("paragraph", { indent: nextIndent }) || commands.updateAttributes("heading", { indent: nextIndent });
      },
      decreaseIndent: () => ({ editor, commands }: { editor: any; commands: any }) => {
        if (editor.isActive("listItem")) {
          const listItemIndent = Number(editor.getAttributes("listItem").indent ?? 0);
          return commands.updateAttributes("listItem", { indent: Math.max(0, listItemIndent - 1) });
        }

        const paragraphIndent = Number(editor.getAttributes("paragraph").indent ?? 0);
        const headingIndent = Number(editor.getAttributes("heading").indent ?? 0);
        const nextIndent = Math.max(0, Math.max(paragraphIndent, headingIndent) - 1);
        return commands.updateAttributes("paragraph", { indent: nextIndent }) || commands.updateAttributes("heading", { indent: nextIndent });
      },
    } as any;
  },
});

function normalizeCommand(command: string) {
  if (command === "justifyLeft") return "left";
  if (command === "justifyCenter") return "center";
  if (command === "justifyRight") return "right";
  return command;
}

export function TiptapBlockBody({
  html,
  editorClassName = "tiptap-block-editor block-body-editor",
  isFlashing = false,
  highlightIndex = 0,
  highlightFlashKey = 0,
  transferButtonLabels = [],
  onChange,
  editorWrapperClassName = "tiptap-editor-shell",
}: {
  html: string;
  editorClassName?: string;
  isFlashing?: boolean;
  highlightIndex?: number;
  highlightFlashKey?: number;
  transferButtonLabels?: string[];
  onChange: (html: string) => void;
  editorWrapperClassName?: string;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      TiptapIndent,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
    ],
    content: html,
    editorProps: {
      attributes: {
        class: editorClassName,
      },
    },
    onFocus: ({ editor: currentEditor }) => {
      lastActiveTiptapEditor = currentEditor;
      dispatchTiptapHistoryState(currentEditor);
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.getHTML());
      dispatchTiptapHistoryState(currentEditor);
    },
  });

  useEffect(() => {
    if (!editor || editor.isFocused || editor.getHTML() === html) {
      return;
    }

    editor.commands.setContent(html, { emitUpdate: false });
  }, [editor, html]);

  useEffect(() => {
    if (!editor || highlightFlashKey === 0) {
      return undefined;
    }

    const flashTarget = () => {
      const highlightableElements = getHighlightableEditorElements(editor.view.dom, transferButtonLabels);
      const selectedIndex = highlightableElements.length > 0 ? Math.max(0, Math.floor(highlightIndex)) % highlightableElements.length : 0;
      const targetElement = highlightableElements[selectedIndex];

      if (!targetElement) {
        return;
      }

      flashHighlightElement(targetElement);
    };

    flashTarget();
    const timeoutId = window.setTimeout(flashTarget, 50);
    const secondTimeoutId = window.setTimeout(flashTarget, 120);
    return () => {
      window.clearTimeout(timeoutId);
      window.clearTimeout(secondTimeoutId);
    };
  }, [editor, highlightFlashKey, highlightIndex, transferButtonLabels]);

  useEffect(() => {
    if (!editor) {
      return undefined;
    }

    const handleCommand = (event: Event) => {
      if (!editor.isFocused && editor !== lastActiveTiptapEditor) {
        return;
      }

      const detail = (event as CustomEvent<TiptapToolbarCommand>).detail;
      const command = normalizeCommand(detail?.command ?? "");
      const value = detail?.value;
      const chain = editor.chain().focus();

      if (command === "undo") {
        editor.commands.undo();
        requestAnimationFrame(() => dispatchTiptapHistoryState(editor));
        event.preventDefault();
        return;
      }

      if (command === "redo") {
        editor.commands.redo();
        requestAnimationFrame(() => dispatchTiptapHistoryState(editor));
        event.preventDefault();
        return;
      }
      if (command === "indent") {
        (chain as any).increaseIndent().run();
        event.preventDefault();
        return;
      }

      if (command === "outdent") {
        (chain as any).decreaseIndent().run();
        event.preventDefault();
        return;
      }

      if (command === "bold") {
        chain.toggleBold().run();
        event.preventDefault();
        return;
      }

      if (command === "italic") {
        chain.toggleItalic().run();
        event.preventDefault();
        return;
      }

      if (command === "formatBlock") {
        if (value?.toLowerCase() === "h3") {
          chain.toggleHeading({ level: 3 }).run();
          event.preventDefault();
          return;
        }
      }

      if (command === "foreColor" && value) {
        chain.setColor(value).run();
        event.preventDefault();
        return;
      }

      if (command === "left" || command === "center" || command === "right") {
        chain.setTextAlign(command).run();
        event.preventDefault();
        return;
      }

      if (command === "insertUnorderedList") {
        chain.toggleBulletList().run();
        event.preventDefault();
        return;
      }

      if (command === "insertOrderedList") {
        chain.toggleOrderedList().run();
        event.preventDefault();
      }
    };

    window.addEventListener("teamtown:tiptap-command", handleCommand);
    return () => window.removeEventListener("teamtown:tiptap-command", handleCommand);
  }, [editor]);

  return <EditorContent className={editorWrapperClassName} editor={editor} data-text-key="tiptap-body" />;
}


























