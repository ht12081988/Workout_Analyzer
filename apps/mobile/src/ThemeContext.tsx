import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { LightColors, DarkColors } from './theme';

export type ThemeColors = typeof LightColors;

export interface ThemeContextType {
  colors: ThemeColors;
  isDark: boolean;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextType>({
  colors: LightColors,
  isDark: false,
  toggleTheme: () => {},
});

export const ThemeProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [isDark, setIsDark] = useState(false);

  const toggleTheme = () => {
    setIsDark(prev => !prev);
  };

  const colors = isDark ? DarkColors : LightColors;

  return (
    <ThemeContext.Provider value={{ colors, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
