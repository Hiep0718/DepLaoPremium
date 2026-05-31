import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';
import { useConfirmStore } from '../stores/confirmStore';

const ConfirmModal: React.FC = () => {
  const { isOpen, title, message, confirmText, cancelText, isDanger, onConfirm, onCancel } = useConfirmStore();

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-[10000] animate-fadeIn">
      <div 
        className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col transform animate-bounce-in"
        style={{ background: 'var(--bg-panel)', color: 'var(--text-primary)' }}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">{title}</h3>
            <button onClick={onCancel} className="p-1.5 rounded-full hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-secondary)]">
              <X size={20} />
            </button>
          </div>
          
          <div className="flex gap-4">
            {isDanger && (
              <div className="shrink-0 mt-0.5">
                <AlertTriangle size={24} className="text-red-500" />
              </div>
            )}
            <p className="text-[15px] leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap">
              {message}
            </p>
          </div>
        </div>

        <div className="px-6 py-4 flex items-center justify-end gap-3 border-t" style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-active)' }}>
          <button 
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors hover:bg-[var(--bg-hover)] text-[var(--text-primary)] border border-[var(--border-primary)]"
          >
            {cancelText}
          </button>
          <button 
            onClick={onConfirm}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 ${isDanger ? 'bg-red-500' : 'bg-[#0068FF]'}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmModal;
