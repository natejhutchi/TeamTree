import type { DialogueBlock } from "../dialogueTree";
import type { TeamTreeData } from "../treeData";

export type TreeFile = {
  version: 1;
  slug: string;
  name: string;
  isDefault: boolean;
  blocks: DialogueBlock[];
  data: TeamTreeData;
};
