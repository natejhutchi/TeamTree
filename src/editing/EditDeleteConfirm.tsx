import type { PendingEditDelete } from "./editTypes";

export function EditDeleteConfirm({
  pendingEditDelete,
  onCancel,
  onConfirm,
}: {
  pendingEditDelete: Exclude<PendingEditDelete, null>;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="notepad-confirm edit-delete-confirm" role="alertdialog" aria-label="Confirm deletion">
      <p>Delete this {pendingEditDelete.type}?</p>
      <div className="notepad-confirm-actions">
        <button onClick={onCancel} type="button">Cancel</button>
        <button onClick={onConfirm} type="button">Delete</button>
      </div>
    </div>
  );
}
