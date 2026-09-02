import { createRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';
import { AuthProvider } from '@/lib/auth';
import { DirectMessageHub } from '@/components/direct-message-hub';
import { CircleExperience } from '@/components/circle-experience';
import { PeopleDiscovery } from '@/components/people-discovery';

import './index.css';

const isPeopleRoute = window.location.pathname === '/people';

createRoot(document.getElementById('root')!, {
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <AuthProvider>
      {isPeopleRoute ? <PeopleDiscovery /> : <App />}
      {!isPeopleRoute && <DirectMessageHub />}
      {!isPeopleRoute && <CircleExperience />}
    </AuthProvider>
  </ErrorBoundary>,
);
