'use client';

import { ConfirmDialog } from '@/components/ui/Modal';

export interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  itemName: string;
  description?: string;
  isLoading?: boolean;
}

export default function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  itemName,
  description = 'Tindakan ini tidak dapat dibatalkan. Seluruh data terkait yang bergantung pada entitas ini akan terpengaruh.',
  isLoading = false,
}: DeleteConfirmModalProps) {
  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={title}
      description={description}
      targetName={itemName}
      confirmLabel="Ya, Hapus Sekarang"
      cancelLabel="Batal"
      confirmVariant="danger"
      isLoading={isLoading}
    />
  );
}
