import { AlertTriangle } from 'lucide-react';

type ConfirmModalProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

// Styled in-app confirmation for destructive actions (kept consistent with the app theme).
export default function ConfirmModal({ open, title, message, confirmLabel = 'Confirm', onConfirm, onCancel }: ConfirmModalProps) {
  if (!open) return null;
  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="bg-surface border border-border2 rounded-xl shadow-2xl w-[340px] max-w-[90vw] p-6 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="bg-red-500/10 text-red-400 p-2 rounded-lg flex-shrink-0"><AlertTriangle className="w-5 h-5" /></div>
          <h3 className="text-sm font-bold text-text">{title}</h3>
        </div>
        <p className="text-[12px] text-muted leading-relaxed mb-5">{message}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 text-[11px] font-mono font-bold tracking-widest text-muted2 hover:text-text bg-surface2 border border-border rounded-lg transition-colors">CANCEL</button>
          <button onClick={onConfirm} className="px-4 py-2 text-[11px] font-mono font-bold tracking-widest text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
