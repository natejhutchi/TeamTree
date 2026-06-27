import type { ScriptContent } from "../dialogueTree";
import { Icon } from "./Icon";
import { type NameValues, type NavigateToBlock, ScriptContentView } from "./scriptRendering";

type ActiveOverlay = "top" | "team" | "bottom" | "objections";

export function InfoPanels({
  activeOverlay,
  isObjectionsOpen,
  isTeamInfoOpen,
  isTopInfoOpen,
  names,
  navigateToBlock,
  objectionResponses,
  setActiveOverlay,
  setIsObjectionsOpen,
  setIsTeamInfoOpen,
  setIsTopInfoOpen,
  sideInfoResponses,
  topInfoResponses,
}: {
  activeOverlay: ActiveOverlay;
  isObjectionsOpen: boolean;
  isTeamInfoOpen: boolean;
  isTopInfoOpen: boolean;
  names: NameValues;
  navigateToBlock: NavigateToBlock;
  objectionResponses: ScriptContent[][];
  setActiveOverlay: React.Dispatch<React.SetStateAction<ActiveOverlay>>;
  setIsObjectionsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsTeamInfoOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsTopInfoOpen: React.Dispatch<React.SetStateAction<boolean>>;
  sideInfoResponses: ScriptContent[][];
  topInfoResponses: ScriptContent[][];
}) {
  return (
    <>
      <aside className={`team-info-sidebar ${isTeamInfoOpen ? "is-open" : ""} ${activeOverlay === "team" ? "is-front" : ""}`} aria-label="Team information">
        <button
          className="team-info-toggle"
          aria-label={isTeamInfoOpen ? "Collapse team information" : "Expand team information"}
          onClick={() => {
            if (!isTeamInfoOpen) {
              setActiveOverlay("team");
            }
            setIsTeamInfoOpen((isOpen) => !isOpen);
          }}
          type="button"
        >
          <Icon name="badge" />
        </button>
        <div className="team-info-panel">
          {sideInfoResponses.map((response, responseIndex) => (
            <section className="team-info-response" key={`team-info-${responseIndex}`}>
              {response.map((content, contentIndex) => (
                <ScriptContentView
                  content={content}
                  key={`team-info-${responseIndex}-${contentIndex}`}
                  names={names}
                  navigateToBlock={navigateToBlock}
                />
              ))}
            </section>
          ))}
        </div>
      </aside>

      <aside className={`bottom-info-bar ${isTopInfoOpen ? "is-open" : ""} ${activeOverlay === "bottom" ? "is-front" : ""}`} aria-label="Team model information">
        <div className="bottom-info-panel">
          <div className="bottom-info-grid">
            {topInfoResponses.map((response, responseIndex) => (
              <section className="bottom-info-card" key={`bottom-info-${responseIndex}`}>
                {response.map((content, contentIndex) => (
                  <ScriptContentView
                    content={content}
                    key={`bottom-info-${responseIndex}-${contentIndex}`}
                    names={names}
                    navigateToBlock={navigateToBlock}
                  />
                ))}
              </section>
            ))}
          </div>
          <div className="bottom-info-clients" aria-label="Client examples">
            <span>BuildOps</span>
            <span>Built</span>
            <span>Staples</span>
            <span>PureSpectrum</span>
            <span>Shoppers Drug Mart</span>
            <span>Evian</span>
          </div>
        </div>
        <button
          className="bottom-info-toggle"
          aria-label={isTopInfoOpen ? "Collapse team model information" : "Expand team model information"}
          onClick={() => {
            if (!isTopInfoOpen) {
              setActiveOverlay("bottom");
            }
            setIsTopInfoOpen((isOpen) => !isOpen);
          }}
          type="button"
        >
          <Icon name="badge" />
        </button>
      </aside>

      <aside className={`objection-sidebar ${isObjectionsOpen ? "is-open" : ""} ${activeOverlay === "objections" ? "is-front" : ""}`} aria-label="Objection responses">
        <button
          className="objection-toggle"
          aria-label={isObjectionsOpen ? "Collapse objection responses" : "Expand objection responses"}
          onClick={() => {
            if (!isObjectionsOpen) {
              setActiveOverlay("objections");
            }
            setIsObjectionsOpen((isOpen) => !isOpen);
          }}
          type="button"
        >
          <Icon name="badge" />
        </button>
        <div className="objection-panel">
          {objectionResponses.map((response, responseIndex) => (
            <section className="objection-response" key={`objection-${responseIndex}`}>
              {response.map((content, contentIndex) => (
                <ScriptContentView
                  content={content}
                  key={`objection-${responseIndex}-${contentIndex}`}
                  names={names}
                  navigateToBlock={navigateToBlock}
                />
              ))}
            </section>
          ))}
        </div>
      </aside>
    </>
  );
}
