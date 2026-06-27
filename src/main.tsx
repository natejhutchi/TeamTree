import { StrictMode, useRef, useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { TreeModal } from "./components/TreeModal";
import { DialogueCard } from "./components/DialogueCard";
import { InfoPanels } from "./components/InfoPanels";
import { LoginPage } from "./components/LoginPage";
import { NotepadModal } from "./components/NotepadModal";
import { TopBar } from "./components/TopBar";
import { TreeBoard } from "./components/TreeBoard";
import { useTreeData } from "./components/useTreeData";
import { useCanvasNavigation } from "./components/useCanvasNavigation";
import { useCanvasViewport } from "./components/useCanvasViewport";
import { ViewportControls } from "./components/ViewportControls";
import {
  type DialogueBlock,
  dialogueBlocks,
  getMissingTargets,
  objectionResponses,
  teamInfoResponses,
} from "./dialogueTree";
import { useEditMode } from "./editing/useEditMode";
import { useClosedCallAuth, type CompanyMembership } from "./auth/useClosedCallAuth";
import "./styles.css";

function getBlock(id: string) {
  const block = dialogueBlocks.find((item) => item.id === id);

  if (!block) {
    throw new Error(`Missing dialogue block: ${id}`);
  }

  return block;
}

type ActiveOverlay = "top" | "team" | "bottom" | "objections";
const defaultAnnouncements = [
  "Welcome to TeamTownTree, where you'll grow from a calling seed into a fruitful caller.",
  "Every reply from the prospect has a finite number of responses. You'll see them on the current block, just click the right one and see your next line before the prospects even done speaking. You'll be ready.",
  "Practice your delivery without the guess work and learn the lingo as you go, when you get really good, you'll start freestyling your own vibe.",
  "Remember: you are an actor. The character you're playing? Yourself. Deliver the lines naturally with enthusiasm.",
  "Click the tree icon to switch trees or create a new one. Use the edit button to customize your tree. You can only edit your own trees.",
  "If things get hot, you can eject at any time with a polite goodbye, but don't be afraid to push the next line.",
  "You got this, you're going to grow so fast!",
];

const loggedInAnnouncements = defaultAnnouncements;

function App({ membership, onLogout }: { membership: CompanyMembership; onLogout: () => void }) {
  const [isObjectionsOpen, setIsObjectionsOpen] = useState(false);
  const [isTeamInfoOpen, setIsTeamInfoOpen] = useState(false);
  const [isTopInfoOpen, setIsTopInfoOpen] = useState(false);
  const [activeOverlay, setActiveOverlay] = useState<ActiveOverlay>("bottom");
  const [prospectName, setProspectName] = useState("");
  const [repName, setRepName] = useState("");
  const [isTopBarOpen, setIsTopBarOpen] = useState(true);

  const [isNotepadOpen, setIsNotepadOpen] = useState(false);
  const [isNotepadClosing, setIsNotepadClosing] = useState(false);
  const [isTreeModalOpen, setIsTreeModalOpen] = useState(false);
  const [isTreeModalClosing, setIsTreeModalClosing] = useState(false);
  const treeData = useTreeData();
  const {
    archivedTrees,
    copyTree,
    createBlankTree,
    deleteSelectedTree,
    hiddenAnnouncementIndexes,
    logout,
    noteDraft,
    pendingNoteDeleteIndex,
    renameSelectedTree,
    restoreTree,
    selectedTreeId,
    setHiddenAnnouncementIndexes,
    setNoteDraft,
    setPendingNoteDeleteIndex,
    switchTree,
    treeError,
    treeNotes,
    trees,
  } = treeData;
  const missingTargets = getMissingTargets(dialogueBlocks);
  const topInfoResponses = teamInfoResponses.slice(0, 4);
  const sideInfoResponses = teamInfoResponses.slice(4);
  const names = { prospectName, repName };
  const announcements = loggedInAnnouncements;

  const isModalOpen = isNotepadOpen || isNotepadClosing || isTreeModalOpen || isTreeModalClosing;
  const editModeRef = useRef(false);
  const viewport = useCanvasViewport({ isEditModeRef: editModeRef });
  const navigation = useCanvasNavigation({ isEditModeRef: editModeRef });
  const { canUndo, flashingBlockId, goToHistoryIndex, historyIndex, navigateToBlock, selectedBlockId } = navigation;
  const edit = useEditMode({
    scrollToTextKey: navigation.scrollToTextKey,
    setFlashingBlockId: navigation.setFlashingBlockId,
    setSelectedBlockId: navigation.setSelectedBlockId,
    treeScale: viewport.treeScale,
  });
  editModeRef.current = edit.isEditMode;

  function openNotepad() {
    setIsNotepadClosing(false);
    setIsNotepadOpen(true);
  }

  function closeNotepad() {
    if (isNotepadClosing) {
      return;
    }

    setPendingNoteDeleteIndex(null);
    setIsNotepadClosing(true);
    window.setTimeout(() => {
      setIsNotepadOpen(false);
      setIsNotepadClosing(false);
    }, 240);
  }

  function openTreeModal() {
    setIsTreeModalClosing(false);
    treeData.prepareTreeModal();
    setIsTreeModalOpen(true);
  }

  function closeTreeModal() {
    if (isTreeModalClosing) {
      return;
    }

    setIsTreeModalClosing(true);
    window.setTimeout(() => {
      setIsTreeModalOpen(false);
      setIsTreeModalClosing(false);
    }, 240);
  }

  function selectBlockForEdit(id: string) {
    navigation.setSelectedBlockId(id);
    navigation.setFlashingBlockId(null);
  }

  const renderDialogueBlock = (block: DialogueBlock, isAbsolute = false) => {
    if (edit.deletedBlockIds.has(block.id)) {
      return null;
    }

    return <DialogueCard
      block={block}
      customOptions={edit.resolveCustomOptions(block.id)}
      deletedButtonKeys={edit.deletedButtonKeys}
      isAbsolute={isAbsolute || edit.absoluteBlockIds.has(block.id)}
      isEditMode={edit.isEditMode}
      isFlashing={flashingBlockId === block.id}
      isSelected={selectedBlockId === block.id}
      key={block.id}
      names={names}
      navigateToBlock={navigateToBlock}
      onRequestDeleteBlock={edit.requestDeleteBlock}
      onStartMoveBlock={edit.startMoveBlock}
      onUpdateOption={edit.updateCustomOption}
      pendingEditDelete={edit.pendingEditDelete}
      onCancelDelete={() => edit.setPendingEditDelete(null)}
      onConfirmDelete={edit.confirmEditDelete}
      position={edit.blockPositions[block.id]}
    />;
  };

  const renderBlock = (id: string) => {
    if (edit.deletedBlockIds.has(id)) {
      return null;
    }

    return renderDialogueBlock(getBlock(id));
  };

  return (
    <div className={`app-viewport ${isModalOpen ? "is-modal-open" : ""} ${edit.isEditMode ? "is-edit-mode" : ""}`} style={{ "--tree-scale": viewport.treeScale } as CSSProperties}>
      <ViewportControls
        canUndo={edit.isEditMode ? edit.editHistory.length > 0 : canUndo}
        goToHistoryIndex={goToHistoryIndex}
        historyIndex={historyIndex}
        isEditMode={edit.isEditMode}
        navigateToBlock={navigateToBlock}
        onToggleEditMode={edit.toggleEditMode}
        onAddBlock={edit.addCustomBlock}
        onUndoEdit={edit.undoEdit}
        onZoomIn={viewport.zoomIn}
        onZoomOut={viewport.zoomOut}
        openNotepad={openNotepad}
        openTreeModal={openTreeModal}
      />

      <TreeModal
        archivedTrees={archivedTrees}
        closeTreeModal={closeTreeModal}
        copyTree={copyTree}
        createBlankTree={createBlankTree}
        deleteSelectedTree={deleteSelectedTree}
        isTreeModalClosing={isTreeModalClosing}
        isTreeModalOpen={isTreeModalOpen}
        renameSelectedTree={renameSelectedTree}
        restoreTree={restoreTree}
        selectedTreeId={selectedTreeId}
        switchTree={switchTree}
        treeError={treeError}
        trees={trees}
      />

      <NotepadModal
        addUserNote={treeData.addTreeNote}
        closeNotepad={closeNotepad}
        confirmDeleteNote={treeData.confirmDeleteNote}
        isNotepadClosing={isNotepadClosing}
        isNotepadOpen={isNotepadOpen}
        noteDraft={noteDraft}
        pendingNoteDeleteIndex={pendingNoteDeleteIndex}
        setNoteDraft={setNoteDraft}
        setPendingNoteDeleteIndex={setPendingNoteDeleteIndex}
        userNotes={treeNotes}
      />

      <TopBar
        announcements={announcements}
        hiddenAnnouncementIndexes={hiddenAnnouncementIndexes}
        isFront={activeOverlay === "top"}
        isTopBarOpen={isTopBarOpen}
        onLogout={() => { logout(() => edit.setIsEditMode(false)); onLogout(); }}
        prospectName={prospectName}
        repName={repName}
        setActiveOverlay={setActiveOverlay}
        setHiddenAnnouncementIndexes={setHiddenAnnouncementIndexes}
        setIsTopBarOpen={setIsTopBarOpen}
        setProspectName={setProspectName}
        setRepName={setRepName}
      />

      <InfoPanels
        activeOverlay={activeOverlay}
        isObjectionsOpen={isObjectionsOpen}
        isTeamInfoOpen={isTeamInfoOpen}
        isTopInfoOpen={isTopInfoOpen}
        names={names}
        navigateToBlock={navigateToBlock}
        objectionResponses={objectionResponses}
        setActiveOverlay={setActiveOverlay}
        setIsObjectionsOpen={setIsObjectionsOpen}
        setIsTeamInfoOpen={setIsTeamInfoOpen}
        setIsTopInfoOpen={setIsTopInfoOpen}
        sideInfoResponses={sideInfoResponses}
        topInfoResponses={topInfoResponses}
      />

      <div className="canvas-scroll">
        <TreeBoard
          customBlocks={edit.customBlocks}
          customOptionConflicts={edit.customOptionConflicts}
          missingTargets={missingTargets}
          renderBlock={renderBlock}
          renderCustomBlock={(block) => renderDialogueBlock(block, edit.absoluteBlockIds.has(block.id))}
        />
      </div>
    </div>
  );
}

function Root() {
  const auth = useClosedCallAuth();

  if (auth.isLoading) {
    return <LoginPage authError="" isConfigured={auth.isConfigured} isLoading={true} onGoogleLogin={auth.signInWithGoogle} />;
  }

  if (!auth.session || !auth.membership) {
    return <LoginPage authError={auth.authError} isConfigured={auth.isConfigured} isLoading={false} onGoogleLogin={auth.signInWithGoogle} />;
  }

  return <App membership={auth.membership} onLogout={auth.signOut} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
