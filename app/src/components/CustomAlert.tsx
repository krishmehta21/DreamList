import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { DL, DLFonts } from '@/constants/design';

interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface AlertState {
  visible: boolean;
  title: string;
  message?: string;
  buttons?: AlertButton[];
}

let globalAlertHandler: ((title: string, message?: string, buttons?: AlertButton[]) => void) | null = null;

export const CustomAlert = {
  alert: (title: string, message?: string, buttons?: AlertButton[], options?: any) => {
    if (globalAlertHandler) {
      globalAlertHandler(title, message, buttons);
    } else {
      console.warn('CustomAlert handler not registered. Fallback console print:', title, message);
    }
  }
};

export const CustomAlertModal: React.FC = () => {
  const [state, setState] = useState<AlertState>({
    visible: false,
    title: '',
    message: '',
  });

  useEffect(() => {
    globalAlertHandler = (title: string, message?: string, buttons?: AlertButton[]) => {
      setState({
        visible: true,
        title,
        message,
        buttons,
      });
    };

    return () => {
      globalAlertHandler = null;
    };
  }, []);

  const handleButtonPress = (onPress?: () => void) => {
    setState((prev) => ({ ...prev, visible: false }));
    if (onPress) {
      onPress();
    }
  };

  const defaultButtons: AlertButton[] = [{ text: 'OK', style: 'default' }];
  const buttonsToRender = state.buttons && state.buttons.length > 0 ? state.buttons : defaultButtons;

  // Layout side-by-side if <= 2 buttons
  const isRowLayout = buttonsToRender.length <= 2;

  return (
    <Modal
      transparent
      visible={state.visible}
      animationType="fade"
      onRequestClose={() => handleButtonPress()}
    >
      <View style={styles.backdrop}>
        <View style={styles.alertBox}>
          <Text style={styles.title}>{state.title}</Text>
          {state.message ? <Text style={styles.message}>{state.message}</Text> : null}

          <View style={[styles.buttonContainer, isRowLayout ? styles.row : styles.column]}>
            {buttonsToRender.map((btn, idx) => {
              const isCancel = btn.style === 'cancel';
              const isDestructive = btn.style === 'destructive';
              
              let buttonStyle: any = styles.btnDefault;
              let textStyle: any = styles.btnTextDefault;

              if (isCancel) {
                buttonStyle = styles.btnCancel;
                textStyle = styles.btnTextCancel;
              } else if (isDestructive) {
                buttonStyle = styles.btnDestructive;
                textStyle = styles.btnTextDestructive;
              }

              return (
                <Pressable
                  key={idx}
                  style={({ pressed }) => [
                    buttonStyle,
                    pressed && { opacity: 0.8 },
                    isRowLayout && { flex: 1 }
                  ]}
                  onPress={() => handleButtonPress(btn.onPress)}
                >
                  <Text style={textStyle}>{btn.text.toUpperCase()}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  alertBox: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 24,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    fontFamily: DLFonts.sans,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  message: {
    fontFamily: DLFonts.sans,
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 24,
    textAlign: 'center',
  },
  buttonContainer: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  column: {
    flexDirection: 'column',
  },
  btnDefault: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnTextDefault: {
    fontFamily: DLFonts.mono,
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  btnCancel: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnTextCancel: {
    fontFamily: DLFonts.mono,
    fontSize: 11,
    fontWeight: 'bold',
    color: '#475569',
    letterSpacing: 1,
  },
  btnDestructive: {
    backgroundColor: '#EF4444',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnTextDestructive: {
    fontFamily: DLFonts.mono,
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
});
