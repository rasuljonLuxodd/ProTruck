import { Modal } from './Modal';
import { useT } from '@/i18n/LanguageProvider';

interface Props {
  open: boolean;
  title?: string;
  message?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, message, onConfirm, onCancel }: Props) {
  const t = useT();
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title ?? t('common.confirmDelete')}
      size="sm"
      footer={
        <>
          <button className="btn-secondary" onClick={onCancel}>
            {t('common.cancel')}
          </button>
          <button className="btn-danger" onClick={onConfirm}>
            {t('common.delete')}
          </button>
        </>
      }
    >
      {message ? <p className="text-sm text-fg-muted">{message}</p> : null}
    </Modal>
  );
}
