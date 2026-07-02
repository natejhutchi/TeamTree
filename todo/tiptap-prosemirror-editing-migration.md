# TipTap / ProseMirror Editing Migration Plan

## Goal
Replace the fragile raw `contentEditable` editing surfaces with a real editor engine while keeping the current canvas, tree, block, panel, Supabase, and navigation systems intact.

The editor should handle normal text editing reliably: cursor placement, Enter/new lines, text selection, bold, italic, lists, indentation, alignment, colors, and undo behavior. TeamTree-specific behavior should be layered on top.

## Key Decision
Do **not** create a special "button-looking centered line" node.

A transfer button is just normal text whose visible style comes from ordinary formatting:
- center alignment
- bold
- color

If that text exactly matches another block title, it becomes clickable in read mode and transfers to that block.

## What Stays As-Is
- Canvas pan / zoom
- Block positioning and z-index
- Tree switching and tree creation
- Supabase persistence model
- Auth / team / tree structure
- Block title field as a separate editable value
- Existing default tree can stay in the old format until rebuilt or converted

## What Changes
- New blocks use TipTap JSON for body content instead of saved HTML.
- Panels eventually use TipTap JSON too: top, left, right, bottom.
- Regular mode renders TipTap JSON into the current visual style.
- Edit mode uses the TipTap editor for text surfaces.

## Data Shape
Each block should move toward:

```ts
{
  id: string;
  title: string;
  body: TipTapJsonDoc;
  position: { x: number; y: number };
}
```

Panels should move toward:

```ts
{
  top: TipTapJsonDoc;
  left: TipTapJsonDoc;
  right: TipTapJsonDoc;
  bottom: TipTapJsonDoc;
}
```

Keep legacy HTML support temporarily so existing trees do not break.

## Phase 1: Add Editor Foundation
- Install TipTap packages.
- Create `src/editor/TreeTextEditor.tsx`.
- Create `src/editor/treeEditorSchema.ts` for shared extensions/config.
- Support starter extensions:
  - document
  - paragraph
  - text
  - bold
  - italic
  - bullet list
  - ordered list
  - text align
  - color
  - indentation if needed
- Create `src/editor/renderTreeDoc.tsx` or equivalent for read-only rendering.
- Verify build.

## Phase 2: Use TipTap For New Blocks Only
- New blank blocks should be created with TipTap JSON body content.
- Existing/default blocks keep current rendering/editing path.
- Add type guards:
  - `bodyHtml` legacy content
  - `bodyDoc` TipTap JSON content
- Toolbar buttons should call TipTap commands when editing a TipTap block.
- Verify:
  - new block typing
  - Enter behavior
  - selection
  - bold/italic/color/alignment
  - saving to Supabase
  - regular mode rendering

## Phase 3: Transfer Button Detection
- In regular mode, scan rendered text against the current block-title map.
- Match exact block titles, case-sensitive.
- Longest title match wins.
- If duplicate titles exist, show conflict warning and do not create an ambiguous transfer.
- Clicking matched text should:
  - select target block
  - center target block
  - flash first paragraph
- Formatting remains normal text formatting, not a custom button node.

## Phase 4: Placeholder Tokens
- Add a placeholder/token extension for `Prospect` and `Rep`.
- These should render muted + italic like current placeholders.
- They should use top-bar Prospect / Rep values in read mode.
- Keep token behavior stable when typing/editing around them.

## Phase 5: Panels
- Move side panels and bottom/top bar text onto the same TipTap system.
- Panels should save inside the tree JSON, not as overrides.
- Keep bottom panel layout rules separate from the editor body.
- Verify transfer-title detection works in panels too.

## Phase 6: Migration / Rebuild Default Tree
- Option A: manually rebuild the default tree using the new editor.
- Option B: write a converter from current HTML/script content to TipTap JSON.
- Keep old `dialogueTree.ts` until the default tree is fully represented in Supabase as tree JSON and no longer needed for runtime fallback.

## Rollout Strategy
- Do not replace all existing editing at once.
- First ship TipTap on newly created blocks only.
- Keep old and new formats side-by-side until TipTap behavior is proven.
- Once stable, convert/rebuild existing default tree content.

## Risks
- Migrating current saved HTML perfectly may take time.
- Custom placeholder behavior needs careful testing.
- Transfer matching must be deterministic and simple.
- TipTap introduces new dependencies, so keep the wrapper isolated.

## Success Criteria
- Cursor/new-line behavior feels native.
- Drag text selection works naturally.
- Formatting persists in edit mode and regular mode.
- New blocks save/reload correctly from Supabase.
- Transfer buttons work from formatted text without needing special button nodes.
- Existing trees continue to render while migration is in progress.
