import { useEffect, useRef } from 'react';
import './ConfirmDialog.css';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'primary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'primary',
  onConfirm,
  onCancel,
}: ConfirmDialogProps): JSX.Element {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // Store the previously focused element
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Focus the cancel button (safer default)
    cancelButtonRef.current?.focus();

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    // Handle Escape key
    const handleEscape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    // Handle Tab key for focus trap
    const handleTab = (e: KeyboardEvent): void => {
      if (e.key === 'Tab') {
        const focusableElements = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        if (!focusableElements || focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          // Shift + Tab
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('keydown', handleTab);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('keydown', handleTab);
      document.body.style.overflow = '';

      // Restore focus to previous element
      previousActiveElement.current?.focus();
    };
  }, [onCancel]);

  const handleOverlayClick = (): void => {
    onCancel();
  };

  const handleContentClick = (e: React.MouseEvent): void => {
    e.stopPropagation();
  };

  return (
    <div className="confirm-dialog-overlay" onClick={handleOverlayClick} role="presentation">
      <div
        ref={dialogRef}
        className="confirm-dialog-content"
        onClick={handleContentClick}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
      >
        <h2 id="confirm-dialog-title" className="confirm-dialog-title">
          {title}
        </h2>
        <p id="confirm-dialog-message" className="confirm-dialog-message">
          {message}
        </p>
        <div className="confirm-dialog-actions">
          <button
            ref={cancelButtonRef}
            className="confirm-btn confirm-btn-secondary"
            onClick={onCancel}
            type="button"
          >
            {cancelText}
          </button>
          <button
            ref={confirmButtonRef}
            className={`confirm-btn confirm-btn-${confirmVariant}`}
            onClick={onConfirm}
            type="button"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
