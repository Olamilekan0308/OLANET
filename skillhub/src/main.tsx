import { createRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';
import { AuthProvider } from '@/lib/auth';
import { DirectMessageHub } from '@/components/direct-message-hub';

import './index.css';

createRoot(document.getElementById('root')!, {
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <AuthProvider>
      <App />
      <DirectMessageHub />
    </AuthProvider>
  </ErrorBoundary>,
);
