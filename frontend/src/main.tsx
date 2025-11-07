import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';

export const ColorModeContext = React.createContext<{ mode: 'light' | 'dark'; toggleColorMode: () => void }>({
  mode: 'light',
  toggleColorMode: () => {},
});

function Root() {
  const prefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const [mode, setMode] = React.useState<'light' | 'dark'>(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem('color-mode') : null;
    if (stored === 'light' || stored === 'dark') return stored;
    return prefersDark ? 'dark' : 'light';
  });

  React.useEffect(() => {
    window.localStorage.setItem('color-mode', mode);
  }, [mode]);

  React.useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (e: MediaQueryListEvent) => {
      setMode((current) => (window.localStorage.getItem('color-mode') ? current : e.matches ? 'dark' : 'light'));
    };
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  const colorMode = React.useMemo(
    () => ({
      mode,
      toggleColorMode: () => setMode((prev) => (prev === 'light' ? 'dark' : 'light')),
    }),
    [mode]
  );

  const theme = React.useMemo(() => createTheme({ palette: { mode } }), [mode]);

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);

