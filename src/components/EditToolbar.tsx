import { Icon } from "./Icon";

export function EditToolbar({
  onAddBlock,
  onZoomIn,
  onZoomOut,
}: {
  onAddBlock: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}) {
  return (
    <div className="edit-toolbar" aria-label="Edit tools">
      <button aria-label="Zoom out" className="edit-tool-button" onClick={onZoomOut} type="button">
        <Icon name="zoomOut" />
      </button>
      <button aria-label="Zoom in" className="edit-tool-button" onClick={onZoomIn} type="button">
        <Icon name="zoomIn" />
      </button>
      <button aria-label="Add block" className="edit-tool-button" onClick={onAddBlock} type="button">
        <Icon name="squarePull" />
      </button>
    </div>
  );
}