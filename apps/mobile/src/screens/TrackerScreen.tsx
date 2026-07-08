import React, { useState } from 'react';
import { View, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { useTheme } from '../ThemeContext';
import { MaterialIcons } from '@expo/vector-icons';
import { MobileTracker } from '../components/MobileTracker';
import { ConfirmModal } from '../components/ConfirmModal';

export function TrackerScreen({ route, navigation }: any) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors);
  const { exerciseName, mode, trainerId } = route.params;
  const [showExitModal, setShowExitModal] = useState(false);

  return (
    <View style={styles.container}>
      <MobileTracker exerciseType={exerciseName} mode={mode} trainerId={trainerId} />
      
      {/* Absolute Back Button floating over the camera */}
      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => setShowExitModal(true)}
      >
        <MaterialIcons name="arrow-back" size={28} color="white" />
      </TouchableOpacity>
      
      <ConfirmModal
        visible={showExitModal}
        title="Confirm Exit"
        message="Are you sure you want to exit the tracking session?"
        confirmText="Exit"
        isDestructive={true}
        onCancel={() => setShowExitModal(false)}
        onConfirm={() => {
          setShowExitModal(false);
          navigation.goBack();
        }}
      />
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  }
});
