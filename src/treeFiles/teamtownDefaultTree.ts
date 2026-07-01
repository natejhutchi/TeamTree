import { dialogueBlocks } from "../dialogueTree";
import { emptyTreeData } from "../treeData";
import type { TreeFile } from "./treeFileTypes";

export const teamtownDefaultTree: TreeFile = {
  version: 1,
  slug: "teamtree-default",
  name: "Example",
  isDefault: true,
  blocks: dialogueBlocks,
  data: {
    ...emptyTreeData(),
    source: "tree-file:teamtree-default",
    blocks: dialogueBlocks,
    hideDefaultBlocks: true,
    starterBlockId: "start",
  },
};
