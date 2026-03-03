// ─────────────────────────────────────────────────────────────────────────────
// OperationsTable — list, add, edit, delete operations
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import type { Operation } from '../types';

interface Props {
  operations: Operation[];
  isLoading: boolean;
  isMutating: boolean;
  onEdit: (op: Operation) => void;
  onDelete: (operationId: string) => void;
  onAdd: () => void;
}

export const OperationsTable: React.FC<Props> = ({
  operations,
  isLoading,
  isMutating,
  onEdit,
  onDelete,
  onAdd,
}) => {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDeleteClick = (id: string) => {
    setConfirmDeleteId(id);
  };

  const handleDeleteConfirm = () => {
    if (confirmDeleteId) {
      onDelete(confirmDeleteId);
      setConfirmDeleteId(null);
    }
  };

  const handleDeleteCancel = () => setConfirmDeleteId(null);

  return (
    <div className="operations-table" data-testid="operations-table">
      <div className="operations-table__header">
        <h3 className="operations-table__title">Operations</h3>
        <button
          className="operations-table__add-btn"
          onClick={onAdd}
          disabled={isMutating || isLoading}
          aria-label="Add operation"
          data-testid="add-operation-btn"
        >
          + Add Operation
        </button>
      </div>

      {isLoading ? (
        <p className="operations-table__loading" role="status">Loading operations…</p>
      ) : operations.length === 0 ? (
        <p className="operations-table__empty" data-testid="operations-empty">
          No operations yet. Add one to get started.
        </p>
      ) : (
        <div className="operations-table__scroll-wrapper">
          <table aria-label="Operations list">
            <thead>
              <tr>
                <th scope="col">Type</th>
                <th scope="col">X (mm)</th>
                <th scope="col">Y (mm)</th>
                <th scope="col">Depth (mm)</th>
                <th scope="col">Tool</th>
                <th scope="col">Notes</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {operations.map((op) => (
                <tr key={op.id} data-testid={`op-row-${op.id}`}>
                  <td>
                    <span
                      className={`operations-table__type-badge operations-table__type-badge--${op.type.toLowerCase()}`}
                    >
                      {op.type}
                    </span>
                  </td>
                  <td>{op.position.x}</td>
                  <td>{op.position.y}</td>
                  <td>{op.depth}</td>
                  <td>{op.toolName ?? op.toolId ?? '—'}</td>
                  <td className="operations-table__notes-cell">
                    {op.notes || '—'}
                  </td>
                  <td className="operations-table__actions-cell">
                    <button
                      className="operations-table__edit-btn"
                      aria-label={`Edit ${op.type} operation`}
                      data-testid={`edit-op-${op.id}`}
                      disabled={isMutating}
                      onClick={() => onEdit(op)}
                    >
                      Edit
                    </button>
                    {confirmDeleteId === op.id ? (
                      <span className="operations-table__confirm-delete">
                        <button
                          className="operations-table__confirm-btn"
                          data-testid={`confirm-delete-${op.id}`}
                          onClick={handleDeleteConfirm}
                        >
                          Confirm
                        </button>
                        <button
                          className="operations-table__cancel-btn"
                          onClick={handleDeleteCancel}
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        className="operations-table__delete-btn"
                        aria-label={`Delete ${op.type} operation`}
                        data-testid={`delete-op-${op.id}`}
                        disabled={isMutating}
                        onClick={() => handleDeleteClick(op.id)}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default OperationsTable;
