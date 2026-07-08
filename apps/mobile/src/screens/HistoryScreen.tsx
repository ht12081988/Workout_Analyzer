import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, TextInput, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing, Radii } from '../theme';
import { useTheme } from '../ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import { API_BASE_URL } from '../config';

type WorkoutSession = {
  id: string;
  customer_id: string;
  exercise_id: string;
  start_time: string;
  end_time: string;
  total_reps: number;
  average_accuracy: string | number;
  total_duration_seconds: number;
  status: string;
  exercise_name: string;
  exercise_category: string;
  exercise_subcategory: string;
  total_attempts: number;
};

export function HistoryScreen({ navigation }: any) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const insets = useSafeAreaInsets();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Filtering state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedSubCategory, setSelectedSubCategory] = useState('All');

  const fetchHistory = async (isRefreshing = false) => {
    try {
      if (isRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError('');

      const userJson = await AsyncStorage.getItem('visionfit.auth.user');
      if (!userJson) {
        setError('No logged in user found.');
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const user = JSON.parse(userJson);
      const response = await fetch(`${API_BASE_URL}/sessions?customer_id=${user.id}`);

      if (!response.ok) {
        throw new Error('Failed to fetch history');
      }

      const data = await response.json();
      setSessions(data);
    } catch (e) {
      console.error('Fetch history error:', e);
      setError('Could not load workout history.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const datePart = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${datePart}, ${hours}:${minutes} ${ampm}`;
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };



  const handleSignOut = async () => {
    await AsyncStorage.removeItem('visionfit.auth.user');
    navigation.replace('Login');
  };

  const renderItem = ({ item }: { item: WorkoutSession }) => (
    <TouchableOpacity
      style={styles.sessionCard}
      onPress={() => navigation.navigate('SessionDetail', { sessionId: item.id })}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.exerciseName}>{item.exercise_name}</Text>
        <View style={styles.categoryDateRow}>
          <Text style={styles.exerciseCategory} numberOfLines={1}>{item.exercise_category || 'Workout'}</Text>
          <Text style={styles.sessionDate}>{formatDate(item.start_time)}</Text>
        </View>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <MaterialIcons name="fitness-center" size={16} color={colors.primary} />
          <Text style={styles.statLabel}>Reps</Text>
          <Text style={styles.statValue}>{item.total_reps || 0}</Text>
        </View>

        <View style={styles.statBox}>
          <MaterialIcons name="format-list-numbered" size={16} color={colors.secondary} />
          <Text style={styles.statLabel}>Attempts</Text>
          <Text style={styles.statValue}>{item.total_attempts || 0}</Text>
        </View>

        <View style={styles.statBox}>
          <MaterialIcons name="timer" size={16} color="#d35400" />
          <Text style={styles.statLabel}>Duration</Text>
          <Text style={styles.statValue}>{formatDuration(item.total_duration_seconds)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const categories = useMemo(() => {
    const cats = new Set(sessions.map(s => s.exercise_category || 'Workout'));
    return ['All', ...Array.from(cats)];
  }, [sessions]);

  const subCategories = useMemo(() => {
    const filteredByCat = selectedCategory === 'All' 
      ? sessions 
      : sessions.filter(s => (s.exercise_category || 'Workout') === selectedCategory);
    const subCats = new Set(filteredByCat.map(s => s.exercise_subcategory).filter(Boolean));
    return ['All', ...Array.from(subCats)];
  }, [sessions, selectedCategory]);

  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      const matchSearch = s.exercise_name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCat = selectedCategory === 'All' || (s.exercise_category || 'Workout') === selectedCategory;
      const matchSub = selectedSubCategory === 'All' || s.exercise_subcategory === selectedSubCategory;
      return matchSearch && matchCat && matchSub;
    });
  }, [sessions, searchQuery, selectedCategory, selectedSubCategory]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>History</Text>
      </View>

      <View style={styles.filterSection}>
        <View style={styles.searchContainer}>
          <MaterialIcons name="search" size={20} color={colors.outlineVariant} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search workouts..."
            placeholderTextColor={colors.onSurfaceVariant}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialIcons name="close" size={20} color={colors.outlineVariant} />
            </TouchableOpacity>
          )}
        </View>

        {categories.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipContainer}>
            {categories.map(cat => (
              <TouchableOpacity
                key={`cat-${cat}`}
                style={[styles.chip, selectedCategory === cat && styles.chipActive]}
                onPress={() => {
                  setSelectedCategory(cat);
                  setSelectedSubCategory('All');
                }}
              >
                <Text style={[styles.chipText, selectedCategory === cat && styles.chipTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {selectedCategory !== 'All' && subCategories.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipContainer}>
            {subCategories.map(sub => (
              <TouchableOpacity
                key={`sub-${sub}`}
                style={[styles.chip, selectedSubCategory === sub && styles.chipActive]}
                onPress={() => setSelectedSubCategory(sub)}
              >
                <Text style={[styles.chipText, selectedSubCategory === sub && styles.chipTextActive]}>{sub}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchHistory()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : sessions.length === 0 ? (
        <View style={styles.center}>
          <MaterialIcons name="history" size={64} color={colors.outlineVariant} />
          <Text style={styles.emptyText}>No workout history found yet.</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => navigation.navigate('Dashboard')}
          >
            <Text style={styles.retryText}>Start a Practice</Text>
          </TouchableOpacity>
        </View>
      ) : filteredSessions.length === 0 ? (
        <View style={styles.center}>
          <MaterialIcons name="search-off" size={64} color={colors.outlineVariant} />
          <Text style={styles.emptyText}>No sessions match your filters.</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setSearchQuery('');
              setSelectedCategory('All');
              setSelectedSubCategory('All');
            }}
          >
            <Text style={styles.retryText}>Clear Filters</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredSessions}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchHistory(true)} />
          }
        />
      )}

      <View style={[styles.bottomNavContainer, { paddingBottom: Math.max(insets.bottom, 24) + 12 }]}>
        <View style={styles.bottomNavInner}>
          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Dashboard')}>
            <View style={styles.iconCircle}>
              <MaterialIcons name="fitness-center" size={24} color={colors.onSurfaceVariant} />
            </View>
            <Text style={styles.navText}>Practice</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItemActive}>
            <View style={styles.iconCircleActive}>
              <MaterialIcons name="insights" size={24} color={colors.primary} />
            </View>
            <Text style={styles.navTextActive}>History</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={handleSignOut}>
            <View style={styles.iconCircle}>
              <MaterialIcons name="person" size={24} color={colors.onSurfaceVariant} />
            </View>
            <Text style={styles.navText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    padding: Spacing.xl,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: colors.secondary,
    marginBottom: Spacing.xs,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.onSurface,
  },
  filterSection: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    height: 48,
    marginBottom: Spacing.md,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    color: colors.onSurface,
    fontSize: 16,
  },
  chipScroll: {
    marginBottom: Spacing.sm,
  },
  chipContainer: {
    gap: Spacing.sm,
    paddingRight: Spacing.xl,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.round,
    backgroundColor: colors.surfaceContainerHighest,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipActive: {
    backgroundColor: colors.primaryContainer,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.onSurfaceVariant,
    fontSize: 14,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.primary,
    fontWeight: 'bold',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyText: {
    marginTop: Spacing.lg,
    fontSize: 16,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  errorText: {
    color: colors.error,
    fontSize: 16,
    textAlign: 'center',
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
    padding: Spacing.lg,
    paddingBottom: 130, // Increased extra padding for floating bottom nav
  },
  sessionCard: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: Radii.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: colors.primaryContainer,
  },
  cardHeader: {
    flexDirection: 'column',
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceContainer,
    paddingBottom: Spacing.sm,
    marginBottom: Spacing.md,
  },
  categoryDateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.onSurface,
  },
  exerciseCategory: {
    fontSize: 12,
    color: colors.outline,
    textTransform: 'uppercase',
    marginTop: 2,
    flex: 1,
    marginRight: 8,
  },
  sessionDate: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    flexShrink: 0,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLowest,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderRadius: Radii.md,
    marginHorizontal: 4,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    borderWidth: 1,
    borderColor: colors.primaryContainer,
  },
  statLabel: {
    fontSize: 10,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    marginTop: 4,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.onSurface,
    marginTop: 2,
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
});
