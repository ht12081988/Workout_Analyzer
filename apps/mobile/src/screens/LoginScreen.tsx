import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import { Spacing, Radii } from '../theme';
import { useTheme } from '../ThemeContext';
import { API_BASE_URL } from '../config';

export function LoginScreen({ navigation }: any) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.status === 'success') {
        const user = {
          id: data.user?.id,
          name: data.user?.name,
          email: data.user?.email || email,
        };
        await AsyncStorage.setItem('visionfit.auth.user', JSON.stringify(user));
        navigation.replace('Dashboard');
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (e) {
      console.error('Mobile Login Connection Error:', e);
      setError('Could not connect to the server. Check your IP address in config.ts');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Welcome Back,</Text>
          <Text style={styles.subtitle}>Athlete.</Text>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Email Address</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="athlete@performance.ai"
              placeholderTextColor={colors.outlineVariant}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <MaterialIcons name="mail" size={24} color={colors.outlineVariant} style={styles.icon} />
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={colors.outlineVariant}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.icon}>
              <MaterialIcons
                name={showPassword ? 'visibility-off' : 'visibility'}
                size={24}
                color={colors.outlineVariant}
              />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.loginButton, loading && styles.loginButtonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <>
              <Text style={styles.loginButtonText}>Sign In</Text>
              <MaterialIcons name="arrow-forward" size={24} color={colors.onPrimary} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    flex: 1,
    padding: Spacing.xl,
    justifyContent: 'center',
  },
  header: {
    marginBottom: Spacing.xl * 1.5,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: colors.onSurface,
  },
  subtitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: colors.primary,
  },
  errorBox: {
    backgroundColor: colors.errorContainer,
    padding: Spacing.md,
    borderRadius: Radii.md,
    marginBottom: Spacing.lg,
  },
  errorText: {
    color: colors.onErrorContainer,
    fontSize: 14,
  },
  inputContainer: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: colors.onSurfaceVariant,
    marginBottom: Spacing.xs,
    marginLeft: Spacing.xs,
  },
  inputWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  input: {
    height: 64,
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.lg,
    paddingRight: 60,
    fontSize: 16,
    color: colors.onSurface,
  },
  icon: {
    position: 'absolute',
    right: Spacing.lg,
  },
  loginButton: {
    height: 64,
    backgroundColor: 'black',
    borderRadius: Radii.round,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.lg,
    elevation: 4,
    shadowColor: 'black',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: colors.onPrimary,
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: Spacing.sm,
  },
});
