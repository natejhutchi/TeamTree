# TeamTree

A simple single-page dialogue tree app. Every block is rendered at once, and buttons jump to other blocks on the same page with hash links.

## Edit the tree

Edit `src/dialogueTree.ts` to add, remove, or rearrange blocks. Each block has:

- `id`: stable page anchor, used by buttons.
- `title`: block heading.
- `lines`: text lines, with optional bold labels.
- `buttons`: links to other block ids.
- `position`: explicit canvas placement.

## Run locally

```bash
npm install
npm run dev
```