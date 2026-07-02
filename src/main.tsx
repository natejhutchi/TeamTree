import { StrictMode, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { TreeModal } from "./components/TreeModal";
import { DialogueCard } from "./components/DialogueCard";
import { InfoPanels } from "./components/InfoPanels";
import { LoginPage } from "./components/LoginPage";
import { LogoutModal } from "./components/LogoutModal";
import { TopBar } from "./components/TopBar";
import { TreeBoard } from "./components/TreeBoard";
import { useTreeData } from "./components/useTreeData";
import { useCanvasNavigation } from "./components/useCanvasNavigation";
import { useCanvasViewport } from "./components/useCanvasViewport";
import { ViewportControls } from "./components/ViewportControls";
import { useModalTransition } from "./components/useModalTransition";
import {
  type DialogueBlock,
  getMissingTargets,
  objectionResponses,
  teamInfoResponses,
} from "./dialogueTree";
import { useEditMode } from "./editing/useEditMode";
import { defaultAnnouncements } from "./defaultAnnouncements";
import { useTeamTownAuth, type TeamMembership } from "./auth/useTeamTownAuth";
import "./styles.css";

type ActiveOverlay = "top" | "team" | "bottom" | "objections";

function App({ googleDisplayName, membership, onLogout, userEmail }: { googleDisplayName: string; membership: TeamMembership; onLogout: () => void; userEmail: string }) {
  const [isObjectionsOpen, setIsObjectionsOpen] = useState(false);
  const [isTeamInfoOpen, setIsTeamInfoOpen] = useState(false);
  const [isTopInfoOpen, setIsTopInfoOpen] = useState(false);
  const [activeOverlay, setActiveOverlay] = useState<ActiveOverlay>("bottom");
  const [prospectName, setProspectName] = useState("");
  const [repName, setRepName] = useState("");
  const [isTopBarOpen, setIsTopBarOpen] = useState(false);
  const suggestedUsername = useMemo(() => {
    const googleFirstName = googleDisplayName.trim().split(/\s+/)[0] || "";
    const emailName = userEmail.split("@")[0] || "";
    return googleFirstName || membership.display_name || emailName;
  }, [googleDisplayName, membership.display_name, userEmail]);
  const [username, setUsername] = useState(suggestedUsername);
  const [usernameDraft, setUsernameDraft] = useState(suggestedUsername);

  useEffect(() => {
    setUsername((currentUsername) => currentUsername || suggestedUsername);
    setUsernameDraft((currentDraft) => currentDraft || suggestedUsername);
  }, [suggestedUsername]);

  const treeModal = useModalTransition(240);
  const logoutModal = useModalTransition(220);

  const treeData = useTreeData(membership, username);
  const {
    activeTree,
    copyTree,
    createBlankTree,
    deleteSelectedTree,
    deleteTreeNote,
    hiddenAnnouncementIndexes,
    logout,
    noteDraft,
    pendingNoteDeleteIndex,
    renameSelectedTree,
    saveTreeData,
    selectedTreeId,
    setHiddenAnnouncementIndexes,
    setNoteDraft,
    setPendingNoteDeleteIndex,
    switchTree,
    treeError,
    treeNotes,
    trees,
  } = treeData;
  const showDefaultBlocks = false;
  const visibleBaseDialogueBlocks: DialogueBlock[] = [];
  const topInfoResponses = teamInfoResponses.slice(0, 4);
  const sideInfoResponses = teamInfoResponses.slice(4);
  const names = { prospectName, repName };
  const announcements = activeTree?.tree.panels.top?.announcements ?? defaultAnnouncements;

  const isModalOpen = treeModal.isOpen || treeModal.isClosing || logoutModal.isOpen || logoutModal.isClosing;
  const editModeRef = useRef(false);
  const viewport = useCanvasViewport({ isEditModeRef: editModeRef });
  const navigation = useCanvasNavigation({ centerBlock: viewport.centerBlock, centerTextKey: viewport.centerTextKey });
  const { canUndo, flashingBlockId, goToHistoryIndex, historyIndex, navigateToBlock, selectedBlockId } = navigation;
  const edit = useEditMode({
    baseBlocks: visibleBaseDialogueBlocks,
    initialTreeData: activeTree?.tree ?? null,
    onTreeDataChange: (nextData) => {
      if (!activeTree) return false;
      return saveTreeData(activeTree.id, nextData);
    },
    scrollToTextKey: navigation.scrollToTextKey,
    setFlashingBlockId: navigation.setFlashingBlockId,
    setSelectedBlockId: navigation.setSelectedBlockId,
    treeDataKey: activeTree?.id,
    treeScale: viewport.treeScale,
    viewportTransform: viewport.transform,
  });
  editModeRef.current = edit.isEditMode;

  const renderedBlocks = [...visibleBaseDialogueBlocks, ...edit.customBlocks];
  const renderedBlocksById = new Map(renderedBlocks.map((block) => [block.id, block]));
  const freeformBlocks = edit.customBlocks;

  const transferTitleTargets = useMemo(() => {
    const targets = renderedBlocks.reduce<Record<string, string[]>>((titles, block) => {
      const title = (edit.blockOverrides[block.id]?.title ?? block.title).trim();
      if (!title) return titles;
      titles[title] = [...(titles[title] ?? []), block.id];
      return titles;
    }, {});


    return targets;
  }, [edit.blockOverrides, renderedBlocks]);
  const missingTargets: ReturnType<typeof getMissingTargets> = [];
  const titleConflicts = Object.entries(transferTitleTargets)
    .filter(([, matches]) => matches.length > 1)
    .map(([label, matches]) => ({ blockId: "title", label, matches }));

  const lastCenteredTreeIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activeTree?.id || lastCenteredTreeIdRef.current === activeTree.id) return;

    lastCenteredTreeIdRef.current = activeTree.id;
    window.requestAnimationFrame(() => navigateToBlock(activeTree.tree.starterBlockId ?? "start"));
  }, [activeTree?.id, activeTree?.tree.starterBlockId, navigateToBlock]);

  function openTreeModal() {
    treeData.prepareTreeModal();
    treeModal.open();
  }

  function closeTreeModal() {
    treeModal.close();
  }

  function openLogoutModal() {
    logoutModal.open();
  }

  function closeLogoutModal() {
    logoutModal.close();
  }

  function confirmLogout() {
    logout(() => edit.setIsEditMode(false));
    onLogout();
  }


  const renderDialogueBlock = (block: DialogueBlock, isAbsolute = false) => {
    if (edit.deletedBlockIds.has(block.id)) {
      return null;
    }

    return <DialogueCard
      block={block}
      customOptions={edit.resolveCustomOptions(block.id)}
      blockOverride={edit.blockOverrides[block.id]}
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
      onUpdateBlockOverride={edit.updateBlockOverride}
      onUpdateOption={edit.updateCustomOption}
      onSetStarterBlock={edit.setStarterBlock}
      starterBlockId={edit.starterBlockId}
      transferTitleTargets={transferTitleTargets}
      pendingEditDelete={edit.pendingEditDelete}
      onCancelDelete={() => edit.setPendingEditDelete(null)}
      onConfirmDelete={edit.confirmEditDelete}
      position={edit.blockPositions[block.id]}
      zIndex={edit.blockZIndexes[block.id]}
    />;
  };

  const renderBlock = (id: string) => {
    if (edit.deletedBlockIds.has(id)) {
      return null;
    }

    const block = renderedBlocksById.get(id);
    return block ? renderDialogueBlock(block) : null;
  };

  return (
    <div className={`app-viewport ${isModalOpen ? "is-modal-open" : ""} ${edit.isEditMode ? "is-edit-mode" : ""} ${edit.isSavingEditMode ? "is-saving-edit-mode" : ""}`} style={{ "--canvas-x": `${viewport.transform.x}px`, "--canvas-y": `${viewport.transform.y}px`, "--tree-scale": viewport.treeScale } as CSSProperties}>
      <ViewportControls
        canUndo={edit.isEditMode ? edit.canUndoEdit : canUndo}
        canRedo={edit.isEditMode ? edit.canRedoEdit : false}
        goToHistoryIndex={goToHistoryIndex}
        historyIndex={historyIndex}
        isEditMode={edit.isEditMode}
        isSavingEditMode={edit.isSavingEditMode}
        editSaveError={edit.editSaveError}
        canEditActiveTree={Boolean(activeTree?.canEdit)}
        navigateToBlock={navigateToBlock}
        starterBlockId={edit.starterBlockId}
        onToggleEditMode={edit.toggleEditMode}
        onAddBlock={edit.addCustomBlock}
        onUndoEdit={edit.undoEdit}
        onRedoEdit={edit.redoEdit}
        openTreeModal={openTreeModal}
      />

      <TreeModal
        closeTreeModal={closeTreeModal}
        copyTree={copyTree}
        createBlankTree={createBlankTree}
        deleteSelectedTree={deleteSelectedTree}
        downloadTreeBackup={treeData.downloadTreeBackup}
        isTreeModalClosing={treeModal.isClosing}
        isTreeModalOpen={treeModal.isOpen}
        renameSelectedTree={renameSelectedTree}
        selectedTreeId={selectedTreeId}
        switchTree={switchTree}
        treeError={treeError}
        trees={trees}
      />


      <LogoutModal
        closeLogoutModal={closeLogoutModal}
        confirmLogout={confirmLogout}
        accountEmail={userEmail}
        isLogoutClosing={logoutModal.isClosing}
        isLogoutOpen={logoutModal.isOpen}
        onSaveUsername={() => {
          const nextUsername = usernameDraft.trim();
          setUsername(nextUsername || suggestedUsername);
          setUsernameDraft(nextUsername || suggestedUsername);
        }}
        teamName={membership.team_name}
        username={username}
        usernameDraft={usernameDraft}
        setUsernameDraft={setUsernameDraft}
      />

      <TopBar
        announcements={announcements}
        hiddenAnnouncementIndexes={hiddenAnnouncementIndexes}
        noteDraft={noteDraft}
        notes={treeNotes}
        isFront={activeOverlay === "top"}
        isTopBarOpen={isTopBarOpen}
        isAdmin={membership.member_role === "admin"}
        onOpenLogout={openLogoutModal}
        onOpenSettings={() => undefined}
        onAddNote={treeData.addTreeNote}
        onDeleteNote={deleteTreeNote}
        prospectName={prospectName}
        repName={repName}
        setActiveOverlay={setActiveOverlay}
        setHiddenAnnouncementIndexes={setHiddenAnnouncementIndexes}
        setNoteDraft={setNoteDraft}
        setIsTopBarOpen={setIsTopBarOpen}
        setProspectName={setProspectName}
        setRepName={setRepName}
      />

      <InfoPanels
        activeOverlay={activeOverlay}
        isEditMode={edit.isEditMode}
        isObjectionsOpen={isObjectionsOpen}
        isTeamInfoOpen={isTeamInfoOpen}
        isTopInfoOpen={isTopInfoOpen}
        names={names}
        navigateToBlock={navigateToBlock}
        objectionResponses={objectionResponses}
        onUpdatePanel={edit.updatePanel}
        panels={edit.panels}
        setActiveOverlay={setActiveOverlay}
        setIsObjectionsOpen={setIsObjectionsOpen}
        setIsTeamInfoOpen={setIsTeamInfoOpen}
        setIsTopInfoOpen={setIsTopInfoOpen}
        sideInfoResponses={sideInfoResponses}
        topInfoResponses={topInfoResponses}
        transferTitleTargets={transferTitleTargets}
      />


      <div className="canvas-scroll">
        <TreeBoard
          customBlocks={freeformBlocks}
          customOptionConflicts={[...edit.customOptionConflicts, ...titleConflicts]}
          missingTargets={missingTargets}
          renderBlock={renderBlock}
          renderCustomBlock={(block) => renderDialogueBlock(block, edit.absoluteBlockIds.has(block.id))}
          showDefaultBlocks={showDefaultBlocks}
        />
      </div>
    </div>
  );
}

function Root() {
  const auth = useTeamTownAuth();

  if (auth.isLoading) {
    return <LoginPage authError="" isConfigured={auth.isConfigured} isLoading={true} onGoogleLogin={auth.signInWithGoogle} />;
  }

  if (!auth.session || !auth.membership) {
    const accessDenied = auth.isAccessDenied;

    return <LoginPage accessDenied={accessDenied} authError={auth.authError} isConfigured={auth.isConfigured} isLoading={false} onGoogleLogin={auth.signInWithGoogle} />;
  }

  const googleDisplayName = String(auth.session.user.user_metadata?.full_name ?? auth.session.user.user_metadata?.name ?? "");

  return <App googleDisplayName={googleDisplayName} membership={auth.membership} onLogout={auth.signOut} userEmail={auth.session.user.email ?? ""} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);










































