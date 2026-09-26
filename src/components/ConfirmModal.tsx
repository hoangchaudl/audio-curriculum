import React, { useEffect, useId, useRef } from 'react';

// Shared branded confirmation dialog - replaces native confirm()/alert()
// popups (which look like the browser, not the app, and can't be styled or
// tested consistently) wherever a destructive or hard-to-undo action needs
// a second step: deleting a module, changing someone's role, discarding
// unsaved edits, overwriting a submission.
//
// Built on the native <dialog> (showModal), which gives keyboard and
// screen-reader users a real modal: focus moves into it and stays there,
// Escape cancels, and it's announced as a dialog with its title.
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
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const messageId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={messageId}
      // Escape: let the parent decide (it owns `open`).
      onCancel={e => { e.preventDefault(); onCancel(); }}
      className="m-auto bg-surface text-ink rounded-[32px] p-8 shadow-2xl border-4 border-surface max-w-sm w-[calc(100%-3rem)] backdrop:bg-black/50"
    >
      {open && (
        <>
          <h3 id={titleId} className="text-lg font-black text-[#2E9DF7] mb-2">{title}</h3>
          <p id={messageId} className="text-sm text-gray-600 mb-6">{message}</p>
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
        </>
      )}
    </dialog>
  );
};
