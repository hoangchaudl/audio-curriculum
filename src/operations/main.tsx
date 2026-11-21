import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from '../components/ErrorBoundary.tsx';
import { OperationsApp } from './OperationsApp.tsx';
import '../index.css';
import { LanguageProvider } from './language';

// Separate entry (/operations/): the Curriculum app never loads this code.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <LanguageProvider><OperationsApp /></LanguageProvider>
    </ErrorBoundary>
  </StrictMode>,
);
