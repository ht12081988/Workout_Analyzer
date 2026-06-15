import React from 'react';
import { View, StyleSheet, SafeAreaView, TouchableOpacity, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { MobileTracker } from '../components/MobileTracker';

export function TrackerScreen({ route, navigation }: any) {
  const { exerciseName } = route.params;

  return (
    <View style={styles.container}>
      <MobileTracker exerciseType={exerciseName} />
      
      {/* Absolute Back Button floating over the camera */}
      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => {
          Alert.alert(
            "Confirm Exit",
            "Are you sure you want to exit the tracking session?",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Exit", onPress: () => navigation.goBack(), style: "destructive" }
            ]
          );
        }}
      >
        <MaterialIcons name="arrow-back" size={28} color="white" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
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
