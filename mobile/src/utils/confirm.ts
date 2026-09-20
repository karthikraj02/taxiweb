import { Alert, Platform } from 'react-native';

/** Native confirm dialog on phones, window.confirm on web (Alert buttons are a no-op there). */
export function confirmAction(title: string, message: string, confirmLabel: string, onConfirm: () => void, destructive = true) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Keep', style: 'cancel' },
    { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}
