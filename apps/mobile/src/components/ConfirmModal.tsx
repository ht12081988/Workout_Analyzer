import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { useTheme } from '../ThemeContext';
import { Radii, Spacing } from '../theme';

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  cancelText?: string;
  confirmText?: string;
  onCancel: () => void;
  onConfirm: () => void;
  isDestructive?: boolean;
}

export function ConfirmModal({
  visible,
  title,
  message,
  cancelText = "Cancel",
  confirmText = "Confirm",
  onCancel,
  onConfirm,
  isDestructive = false
}: ConfirmModalProps) {
  const { colors } = useTheme();
  
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
          <Text style={[styles.modalTitle, { color: colors.onSurface }]}>{title}</Text>
          <Text style={[styles.modalDesc, { color: colors.onSurfaceVariant }]}>{message}</Text>
          
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
              <Text style={[styles.cancelText, { color: colors.primary }]}>{cancelText.toUpperCase()}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmButton} onPress={onConfirm}>
              <Text style={[styles.confirmText, { color: isDestructive ? '#FF3B30' : colors.primary }]}>{confirmText.toUpperCase()}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalContent: {
    width: '80%',
    borderRadius: Radii.lg,
    padding: Spacing.xl,
    paddingBottom: Spacing.md,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: Spacing.sm
  },
  modalDesc: {
    fontSize: 16,
    marginBottom: Spacing.xxl
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.lg
  },
  cancelButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  confirmButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  cancelText: {
    fontWeight: 'bold',
    fontSize: 14
  },
  confirmText: {
    fontWeight: 'bold',
    fontSize: 14
  }
});
