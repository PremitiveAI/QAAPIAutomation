"use client";

type ConfirmModalProps = {
  open: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmModal({
  open,
  title = "Confirm Action",
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-gray-800 rounded-xl shadow-xl w-[420px] p-6">
        <h3 className="text-lg font-semibold mb-2 text-gray-200">{title}</h3>

        <p className="text-sm text-gray-400 mb-6 whitespace-pre-line">
          {message}
        </p>

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border text-gray-400 hover:bg-gray-700 hover:text-gray-200"
          >
            {cancelText}
          </button>

          <button
            onClick={onConfirm}
            className=" px-4 py-2 font-bold text-md rounded-lg bg-blue-600 text-white whitespace-nowrap hover:shadow-lg hover:bg-blue-700 "
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}


