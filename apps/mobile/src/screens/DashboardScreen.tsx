import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity, ActivityIndicator, Image, Dimensions, Modal } from 'react-native';

const { width } = Dimensions.get('window');
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing, Radii } from '../theme';
import { useTheme } from '../ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import { API_BASE_URL } from '../config';

type Exercise = {
  id: string;
  name: string;
  description: string;
  category: string;
  image_path?: string;
};

type Trainer = {
  id: string;
  email: string;
  name: string;
  profile_pic?: string;
};

const getExerciseImage = (item: Exercise) => {
  if (item.image_path) {
    if (item.image_path.startsWith('http')) {
      return { uri: item.image_path };
    } else {
      const normalizedPath = item.image_path.replace(/\\/g, '/');
      const pathWithSlash = normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
      const baseUrl = API_BASE_URL.replace(/\/api$/, '');
      return { uri: `${baseUrl}${pathWithSlash}` };
    }
  }
  const normalized = item.name.toLowerCase();
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
  const [selectedTrainer, setSelectedTrainer] = useState<Trainer | null>(null);
  const [mode, setMode] = useState<'self' | 'trainer'>('self');
  const [trainerModalVisible, setTrainerModalVisible] = useState(false);
  const { colors, isDark, toggleTheme } = useTheme();
  const styles = getStyles(colors, isDark);

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
      if (selectedTrainer) {
        navigation.navigate('Tracker', {
          exerciseId: exercise.id,
          exerciseName: exercise.name,
          mode: 'trainer',
          trainerId: selectedTrainer.id
        });
      } else {
        setSelectedExercise(exercise);
        setTrainerModalVisible(true);
      }
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
        <Image source={getExerciseImage(item)} style={styles.exerciseImage} resizeMode="contain" />
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{item.name}</Text>
          <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
          <TouchableOpacity 
            style={styles.startButton}
            onPress={() => handleStartPractice(item)}
          >
            <Text style={styles.startButtonText}>Start Practice</Text>
            <MaterialIcons name="chevron-right" size={24} color={colors.primary} />
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
        <TouchableOpacity onPress={toggleTheme} style={styles.themeToggle}>
          <MaterialIcons name={isDark ? 'light-mode' : 'dark-mode'} size={28} color={colors.primary} />
        </TouchableOpacity>
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
            onPress={() => {
              if (mode === 'trainer') {
                setTrainerModalVisible(true);
              } else {
                setMode('trainer');
                if (!selectedTrainer) {
                  setTrainerModalVisible(true);
                }
              }
            }}
          >
            <Text style={[styles.modeToggleText, mode === 'trainer' && styles.modeToggleTextActive]}>
              {mode === 'trainer' && selectedTrainer ? `Trainer: ${selectedTrainer.name}` : 'Trainer Mode'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
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

      <View style={[styles.bottomNavContainer, { paddingBottom: Math.max(insets.bottom, 24) + 12 }]}>
        <View style={styles.bottomNavInner}>
          <TouchableOpacity style={styles.navItemActive}>
            <View style={styles.iconCircleActive}>
              <MaterialIcons name="fitness-center" size={24} color={colors.primary} />
            </View>
            <Text style={styles.navTextActive}>Practice</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('History')}>
            <View style={styles.iconCircle}>
              <MaterialIcons name="insights" size={24} color={colors.onSurfaceVariant} />
            </View>
            <Text style={styles.navText}>History</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={handleSignOut}>
            <View style={styles.iconCircle}>
              <MaterialIcons name="person" size={24} color={colors.onSurfaceVariant} />
            </View>
            <Text style={styles.navText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={trainerModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setTrainerModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select a Trainer</Text>
            <Text style={styles.modalDesc}>Choose a trainer to share your practice session with.</Text>
            
            {trainers.map(trainer => {
              const isSelected = selectedTrainer?.id === trainer.id;
              return (
                <TouchableOpacity 
                  key={trainer.id}
                  style={[styles.trainerItem, isSelected && styles.trainerItemSelected]}
                  onPress={() => {
                    setTrainerModalVisible(false);
                    setSelectedTrainer(trainer);
                    if (selectedExercise) {
                      navigation.navigate('Tracker', {
                        exerciseId: selectedExercise.id,
                        exerciseName: selectedExercise.name,
                        mode: 'trainer',
                        trainerId: trainer.id
                      });
                      setSelectedExercise(null); // Reset after navigation
                    }
                  }}
                >
                  <View style={styles.trainerAvatar}>
                    {trainer.profile_pic ? (
                      <Image source={{ uri: trainer.profile_pic }} style={styles.trainerAvatarImage} />
                    ) : (
                      <MaterialIcons name="person" size={24} color={colors.onSurfaceVariant} />
                    )}
                  </View>
                  <Text style={[styles.trainerName, isSelected && styles.trainerNameSelected]}>
                    {trainer.name}
                  </Text>
                  {isSelected && (
                    <MaterialIcons name="check-circle" size={24} color={colors.primary} style={{ marginLeft: 'auto' }} />
                  )}
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity 
              style={styles.modalCancel}
              onPress={() => setTrainerModalVisible(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: Spacing.xl,
  },
  themeToggle: {
    padding: Spacing.sm,
    borderRadius: Radii.round,
    backgroundColor: colors.surfaceContainer,
  },
  headerSubtitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    textTransform: 'uppercase',
    color: colors.secondary,
    marginBottom: Spacing.xs,
  },
  headerTitle: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 32,
    color: colors.onSurface,
  },
  modeToggleContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceVariant,
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
    overflow: 'hidden',
  },
  modeToggleBtnActive: {
    backgroundColor: colors.primaryContainer,
  },
  modeToggleText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.onSurfaceVariant,
  },
  modeToggleTextActive: {
    color: colors.primary,
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  errorText: {
    color: colors.error,
    fontSize: 16,
    marginBottom: Spacing.md,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.round,
  },
  retryText: {
    color: colors.onPrimary,
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
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: Radii.xl,
    padding: Spacing.lg,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primaryContainer,
  },
  exerciseImage: {
    width: '100%',
    height: 220,
    marginBottom: Spacing.sm,
  },
  cardContent: {
    width: '100%',
    alignItems: 'center',
  },
  cardTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
    color: colors.onSurface,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  cardDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: colors.onSurfaceVariant,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  startButton: {
    flexDirection: 'row',
    backgroundColor: colors.primaryContainer,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radii.round,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  startButtonText: {
    fontFamily: 'Inter_700Bold',
    color: colors.primary,
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
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
    marginHorizontal: 16,
    borderRadius: 30,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    backgroundColor: colors.surfaceContainerHigh,
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
    backgroundColor: colors.primaryContainer,
  },
  navText: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: colors.onSurfaceVariant,
    marginTop: 4,
  },
  navTextActive: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: colors.primary,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    padding: Spacing.xl,
    paddingBottom: Spacing.xxl
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.onSurface,
    marginBottom: Spacing.xs
  },
  modalDesc: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    marginBottom: Spacing.xl
  },
  modalOptionPrimary: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    padding: Spacing.lg,
    borderRadius: Radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md
  },
  modalOptionPrimaryText: {
    color: colors.onPrimary,
    fontWeight: 'bold',
    fontSize: 16
  },
  modalDivider: {
    height: 1,
    backgroundColor: colors.surfaceVariant,
    marginVertical: Spacing.sm
  },
  modalOptionSecondary: {
    flexDirection: 'row',
    backgroundColor: colors.primaryContainer,
    padding: Spacing.lg,
    borderRadius: Radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm
  },
  modalOptionSecondaryText: {
    color: colors.onPrimaryContainer,
    fontWeight: 'bold',
    fontSize: 16
  },
  trainerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radii.lg,
    marginBottom: Spacing.sm,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.surfaceVariant,
  },
  trainerItemSelected: {
    backgroundColor: colors.primaryContainer,
    borderColor: colors.primary,
  },
  trainerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  trainerAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  trainerName: {
    fontSize: 16,
    color: colors.onSurface,
    fontWeight: '500',
  },
  trainerNameSelected: {
    color: colors.onPrimaryContainer,
    fontWeight: 'bold',
  },
  modalCancel: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    alignItems: 'center'
  },
  modalCancelText: {
    color: colors.secondary,
    fontWeight: 'bold',
    fontSize: 16
  }
});
