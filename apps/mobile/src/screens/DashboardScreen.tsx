import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity, ActivityIndicator, Image, Dimensions, Modal } from 'react-native';

const { width } = Dimensions.get('window');
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Radii } from '../theme';
import { API_BASE_URL } from '../config';

type Exercise = {
  id: string;
  name: string;
  description: string;
  category: string;
};

type Trainer = {
  id: string;
  email: string;
  name: string;
};

const getExerciseImage = (name: string) => {
  const normalized = name.toLowerCase();
  if (normalized.includes('pile squat')) return require('../../assets/pile-squats.jpg');
  if (normalized.includes('squat')) return require('../../assets/squats.jpg');
  if (normalized.includes('lunge')) return require('../../assets/split-lunges.jpg');
  if (normalized.includes('calf')) return require('../../assets/standing-calf-raise.jpg');
  return require('../../assets/icon.png');
};

export function DashboardScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [mode, setMode] = useState<'self' | 'trainer'>('self');

  useEffect(() => {
    fetchExercises();
    fetchUserAndTrainers();
  }, []);

  const fetchUserAndTrainers = async () => {
    try {
      const userJson = await AsyncStorage.getItem('visionfit.auth.user');
      if (userJson) {
        const user = JSON.parse(userJson);
        const res = await fetch(`${API_BASE_URL}/athletes/${user.id}/trainers`);
        if (res.ok) {
          const data = await res.json();
          setTrainers(data);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch trainers', e);
    }
  };

  const fetchExercises = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetch(`${API_BASE_URL}/exercises`);
      const data = await response.json();
      setExercises(data);
    } catch (e) {
      setError('Could not load exercises.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await AsyncStorage.removeItem('visionfit.auth.user');
    navigation.replace('Login');
  };

  const handleStartPractice = (exercise: Exercise) => {
    if (mode === 'trainer' && trainers.length > 0) {
      navigation.navigate('Tracker', {
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        mode: 'trainer',
        trainerId: trainers[0].id
      });
    } else {
      navigation.navigate('Tracker', { 
        exerciseId: exercise.id, 
        exerciseName: exercise.name,
        mode: 'self'
      });
    }
  };

  const renderExercise = ({ item }: { item: Exercise }) => (
    <View style={styles.carouselItem}>
      <View style={styles.card}>
        <Image source={getExerciseImage(item.name)} style={styles.exerciseImage} resizeMode="contain" />
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{item.name}</Text>
          <Text style={styles.cardDesc} numberOfLines={3}>{item.description}</Text>
          <TouchableOpacity 
            style={styles.startButton}
            onPress={() => handleStartPractice(item)}
          >
            <Text style={styles.startButtonText}>Start Practice</Text>
            <MaterialIcons name="chevron-right" size={24} color={Colors.onPrimary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Refine Your Form.</Text>
        </View>
      </View>

      {trainers.length > 0 && (
        <View style={styles.modeToggleContainer}>
          <TouchableOpacity 
            style={[styles.modeToggleBtn, mode === 'self' && styles.modeToggleBtnActive]}
            onPress={() => setMode('self')}
          >
            <Text style={[styles.modeToggleText, mode === 'self' && styles.modeToggleTextActive]}>Self Mode</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.modeToggleBtn, mode === 'trainer' && styles.modeToggleBtnActive]}
            onPress={() => setMode('trainer')}
          >
            <Text style={[styles.modeToggleText, mode === 'trainer' && styles.modeToggleTextActive]}>Trainer Mode</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchExercises}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={exercises}
          keyExtractor={(item) => item.id}
          renderItem={renderExercise}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={width * 0.85}
          snapToAlignment="center"
          decelerationRate="fast"
          contentContainerStyle={[styles.listContainer, { paddingHorizontal: (width - width * 0.85) / 2 }]}
        />
      )}

      <View style={[styles.bottomNavContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.bottomNavInner}>
          <TouchableOpacity style={styles.navItemActive}>
            <View style={styles.iconCircleActive}>
              <MaterialIcons name="fitness-center" size={24} color={Colors.primaryFixed} />
            </View>
            <Text style={styles.navTextActive}>Practice</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('History')}>
            <View style={styles.iconCircle}>
              <MaterialIcons name="insights" size={24} color={Colors.onPrimaryContainer} />
            </View>
            <Text style={styles.navText}>History</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={handleSignOut}>
            <View style={styles.iconCircle}>
              <MaterialIcons name="person" size={24} color={Colors.onPrimaryContainer} />
            </View>
            <Text style={styles.navText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: Spacing.xl,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: Colors.secondary,
    marginBottom: Spacing.xs,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  modeToggleContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceVariant,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    borderRadius: Radii.round,
    padding: 4,
  },
  modeToggleBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: Radii.round,
  },
  modeToggleBtnActive: {
    backgroundColor: Colors.primary,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  modeToggleText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.onSurfaceVariant,
  },
  modeToggleTextActive: {
    color: Colors.onPrimary,
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  errorText: {
    color: Colors.error,
    fontSize: 16,
    marginBottom: Spacing.md,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.round,
  },
  retryText: {
    color: Colors.onPrimary,
    fontWeight: 'bold',
  },
  listContainer: {
    alignItems: 'center',
  },
  carouselItem: {
    width: width * 0.85,
    paddingHorizontal: Spacing.sm,
    justifyContent: 'center',
    paddingBottom: 130, // Increased to clearly avoid bottom nav
  },
  card: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radii.xl,
    padding: Spacing.xl,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    alignItems: 'center',
  },
  exerciseImage: {
    width: '100%',
    height: 280,
    marginBottom: Spacing.md,
  },
  cardContent: {
    width: '100%',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.onSurface,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  cardDesc: {
    fontSize: 14,
    color: Colors.onSurfaceVariant,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  startButton: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radii.round,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  startButtonText: {
    color: Colors.onPrimary,
    fontWeight: 'bold',
    fontSize: 16,
    marginRight: Spacing.sm,
  },
  bottomNavContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
  },
  bottomNavInner: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
    marginHorizontal: 16,
    borderRadius: 30,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 70,
  },
  navItemActive: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 70,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  iconCircleActive: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.primaryContainer,
  },
  navText: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: Colors.onPrimaryContainer,
    marginTop: 4,
  },
  navTextActive: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: Colors.primaryFixed,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    padding: Spacing.xl,
    paddingBottom: Spacing.xxl
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.onSurface,
    marginBottom: Spacing.xs
  },
  modalDesc: {
    fontSize: 14,
    color: Colors.onSurfaceVariant,
    marginBottom: Spacing.xl
  },
  modalOptionPrimary: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    padding: Spacing.lg,
    borderRadius: Radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md
  },
  modalOptionPrimaryText: {
    color: Colors.onPrimary,
    fontWeight: 'bold',
    fontSize: 16
  },
  modalDivider: {
    height: 1,
    backgroundColor: Colors.surfaceVariant,
    marginVertical: Spacing.sm
  },
  modalOptionSecondary: {
    flexDirection: 'row',
    backgroundColor: Colors.primaryContainer,
    padding: Spacing.lg,
    borderRadius: Radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm
  },
  modalOptionSecondaryText: {
    color: Colors.onPrimaryContainer,
    fontWeight: 'bold',
    fontSize: 16
  },
  modalCancel: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    alignItems: 'center'
  },
  modalCancelText: {
    color: Colors.secondary,
    fontWeight: 'bold',
    fontSize: 16
  }
});
