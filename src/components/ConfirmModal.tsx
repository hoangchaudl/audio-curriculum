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
      <div className="bg-white rounded-[32px] p-8 shadow-2xl border-4 border-white max-w-sm w-full">
        <h3 className="text-lg font-black text-[#2E9DF7] mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 bg-gray-100 text-gray-700 font-bold text-sm py-3 rounded-2xl hover:bg-gray-200 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 text-white font-bold text-sm py-3 rounded-2xl active:shadow-none active:translate-y-[2px] transition-all ${
              danger ? 'bg-[#F4511E] shadow-[0_4px_0_#C53914]' : 'bg-[#2E9DF7] shadow-[0_4px_0_#1b85df]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
