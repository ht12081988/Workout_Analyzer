import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Radii } from '../theme';
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
  const insets = useSafeAreaInsets();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

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
          <MaterialIcons name="fitness-center" size={16} color={Colors.primary} />
          <Text style={styles.statLabel}>Reps</Text>
          <Text style={styles.statValue}>{item.total_reps || 0}</Text>
        </View>

        <View style={styles.statBox}>
          <MaterialIcons name="format-list-numbered" size={16} color={Colors.secondary} />
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>History</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
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
          <MaterialIcons name="history" size={64} color={Colors.outlineVariant} />
          <Text style={styles.emptyText}>No workout history found yet.</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => navigation.navigate('Dashboard')}
          >
            <Text style={styles.retryText}>Start a Practice</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchHistory(true)} />
          }
        />
      )}

      <View style={[styles.bottomNavContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.bottomNavInner}>
          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Dashboard')}>
            <View style={styles.iconCircle}>
              <MaterialIcons name="fitness-center" size={24} color={Colors.onPrimaryContainer} />
            </View>
            <Text style={styles.navText}>Practice</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItemActive}>
            <View style={styles.iconCircleActive}>
              <MaterialIcons name="insights" size={24} color={Colors.primaryFixed} />
            </View>
            <Text style={styles.navTextActive}>History</Text>
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyText: {
    marginTop: Spacing.lg,
    fontSize: 16,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  errorText: {
    color: Colors.error,
    fontSize: 16,
    textAlign: 'center',
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
    padding: Spacing.lg,
    paddingBottom: 130, // Increased extra padding for floating bottom nav
  },
  sessionCard: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radii.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  cardHeader: {
    flexDirection: 'column',
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceContainer,
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
    color: Colors.onSurface,
  },
  exerciseCategory: {
    fontSize: 12,
    color: Colors.outline,
    textTransform: 'uppercase',
    marginTop: 2,
    flex: 1,
    marginRight: 8,
  },
  sessionDate: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    flexShrink: 0,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLowest,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderRadius: Radii.md,
    marginHorizontal: 4,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  statLabel: {
    fontSize: 10,
    color: Colors.onSurfaceVariant,
    textTransform: 'uppercase',
    marginTop: 4,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.onSurface,
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
});
