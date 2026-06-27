# TeamTownTree

A simple single-page dialogue tree app. Every block is rendered at once, and buttons jump to other blocks on the same page with hash links.

## Edit the tree

Update `src/dialogueTree.ts`.

```ts
{
  id: "start",
  title: "Opening Block",
  body: ["Dialogue line one.", "Dialogue line two."],
  buttons: [
    { label: "Choose this", target: "next-block" },
  ],
}
```

Each `target` must match another block's `id`. The app displays a warning if a button points to a missing block.

## Run

```bash
npm install
npm run dev
```
