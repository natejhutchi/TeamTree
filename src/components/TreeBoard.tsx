import type { ReactNode } from "react";
import { getMissingTargets, type DialogueBlock } from "../dialogueTree";

export type CustomOptionConflict = {
  blockId: string;
  label: string;
  matches: string[];
};

export function TreeBoard({
  customBlocks,
  customOptionConflicts,
  missingTargets,
  renderBlock,
  renderCustomBlock,
  showDefaultBlocks,
}: {
  customBlocks: DialogueBlock[];
  customOptionConflicts: CustomOptionConflict[];
  missingTargets: ReturnType<typeof getMissingTargets>;
  renderBlock: (id: string) => ReactNode;
  renderCustomBlock: (block: DialogueBlock) => ReactNode;
  showDefaultBlocks: boolean;
}) {
  return (
    <main className="app-shell">
      {(missingTargets.length > 0 || customOptionConflicts.length > 0) ? (
        <section className="tree-warning" aria-label="Tree warnings">
          <strong>Tree warnings</strong>
          <ul>
            {missingTargets.map((target) => (
              <li key={`${target.from}-${target.label}-${target.target}`}>
                <code>{target.from}</code> / {target.label} points to <code>{target.target}</code>
              </li>
            ))}
            {customOptionConflicts.map((conflict) => (
              <li key={`${conflict.blockId}-${conflict.label}`}>
                <code>{conflict.blockId}</code> / {conflict.label} matches multiple blocks
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="tree-board" aria-label="Dialogue blocks">
        {showDefaultBlocks ? (
          <>
            <div className="rush-float">{renderBlock("rush")}</div>

            <div className="board-row board-row-start">{renderBlock("start")}</div>
          </>
        ) : null}

        {customBlocks.map((block) => renderCustomBlock(block))}

        {showDefaultBlocks ? (
          <>
            <div className="board-row board-row-entry">
              {renderBlock("sure")}
              {renderBlock("whos-this")}
            </div>

            <div className="branch-layout">
              <div className="sure-branch">
                <div className="branch-column">
                  {renderBlock("confusion")}
                  {renderBlock("spot-were-in")}
                </div>
                <div className="branch-column">
                  {renderBlock("different-ai")}
                  {renderBlock("different-designer")}
                </div>
              </div>

              <div className="whos-branch">
                {renderBlock("using-ai")}
                {renderBlock("not-using-ai")}
              </div>
            </div>

            <div className="board-row board-row-placeholders">
              {renderBlock("solution")}
              {renderBlock("rush-bullet")}
            </div>

            <div className="outcome-stack">
              {renderBlock("close")}
              {renderBlock("graceful-exit")}
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}