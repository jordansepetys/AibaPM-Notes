// Custom Theme System for Aiba PM
// A unique, modern design with glassmorphism and vibrant gradients

export const theme = {
  // Custom Color Palette - Moving away from default blue
  colors: {
    // Primary: Deep Purple to Violet
    primary: '#6366f1',
    primaryLight: '#818cf8',
    primaryDark: '#4f46e5',
    primaryGradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)',

    // Secondary: Teal to Cyan
    secondary: '#14b8a6',
    secondaryLight: '#2dd4bf',
    secondaryDark: '#0d9488',
    secondaryGradient: 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)',

    // Accent: Pink to Rose
    accent: '#ec4899',
    accentLight: '#f472b6',
    accentDark: '#db2777',
    accentGradient: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',

    // Success: Emerald
    success: '#10b981',
    successLight: '#34d399',

    // Warning: Amber
    warning: '#f59e0b',
    warningLight: '#fbbf24',

    // Error: Red
    error: '#ef4444',
    errorLight: '#f87171',

    // Neutrals with warmth
    bg: '#fafbfc',
    bgDark: '#f3f4f6',
    surface: '#ffffff',
    border: '#e5e7eb',
    text: '#1f2937',
    textLight: '#6b7280',
    textLighter: '#9ca3af',
  },

  // Glassmorphism Effects
  glass: {
    background: 'rgba(255, 255, 255, 0.7)',
    backgroundDark: 'rgba(255, 255, 255, 0.5)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    blur: 'blur(10px)',
    shadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
  },

  // Enhanced Shadows
  shadows: {
    sm: '0 2px 4px rgba(0, 0, 0, 0.05)',
    md: '0 4px 12px rgba(0, 0, 0, 0.08)',
    lg: '0 8px 24px rgba(0, 0, 0, 0.12)',
    xl: '0 12px 48px rgba(0, 0, 0, 0.15)',
    glow: '0 0 20px rgba(99, 102, 241, 0.3)',
    glowAccent: '0 0 20px rgba(236, 72, 153, 0.3)',
  },

  // Typography
  fonts: {
    body: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    heading: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: '"Fira Code", "Consolas", "Monaco", monospace',
  },

  // Border Radius
  radius: {
    sm: '6px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    full: '9999px',
  },

  // Transitions
  transitions: {
    fast: 'all 0.15s ease',
    normal: 'all 0.3s ease',
    slow: 'all 0.5s ease',
  },

  // Gradients
  gradients: {
    primary: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)',
    secondary: 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)',
    accent: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
    sunset: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 50%, #ec4899 100%)',
    ocean: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #6366f1 100%)',
    forest: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)',
  },
};

// CSS Variables Generator
export const generateCSSVariables = () => {
  return `
    :root {
      --color-primary: ${theme.colors.primary};
      --color-primary-light: ${theme.colors.primaryLight};
      --color-primary-dark: ${theme.colors.primaryDark};
      --color-secondary: ${theme.colors.secondary};
      --color-accent: ${theme.colors.accent};
      --color-bg: ${theme.colors.bg};
      --color-surface: ${theme.colors.surface};
      --color-text: ${theme.colors.text};
      --shadow-md: ${theme.shadows.md};
      --radius-md: ${theme.radius.md};
      --transition-normal: ${theme.transitions.normal};
    }
  `;
};

// Helper Functions
export const withGlass = (additionalStyles = {}) => ({
  background: theme.glass.background,
  backdropFilter: theme.glass.blur,
  WebkitBackdropFilter: theme.glass.blur,
  border: theme.glass.border,
  boxShadow: theme.glass.shadow,
  ...additionalStyles,
});

export const withHoverGlow = (baseStyles = {}) => ({
  ...baseStyles,
  transition: theme.transitions.normal,
  '&:hover': {
    boxShadow: theme.shadows.glow,
    transform: 'translateY(-2px)',
  },
});
