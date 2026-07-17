import React from 'react';

// Shared branded confirmation dialog - replaces native confirm()/alert()
// popups (which look like the browser, not the app, and can't be styled or
// tested consistently) wherever a destructive or hard-to-undo action needs
// a second step: deleting a module, changing someone's role, discarding
// unsaved edits, overwriting a submission.
export const ConfirmModal: React.FC<{
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = true, onConfirm, onCancel }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
      <div className="bg-white border-[3px] border-black rounded-2xl p-6 max-w-sm w-full">
        <h3 className="text-lg font-black uppercase text-black mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 bg-white text-black font-black uppercase text-xs tracking-wide py-3 rounded-xl border-2 border-black hover:bg-gray-50 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 text-white font-black uppercase text-xs tracking-wide py-3 rounded-xl border-2 border-black transition-colors ${
              danger ? 'bg-[#B23A2E] hover:bg-black' : 'bg-[#2E9DF7] hover:bg-black'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
