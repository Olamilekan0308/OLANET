import { createRoot } from 'react-dom/client';

import App from './App';
import DepartmentHub from '@/components/department-hub';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';

function RootApp() {
  // The department hub is routed here so the live Circle APIs replace the old demo Circle screen
  // without disturbing the rest of the production shell while the remaining social screens are wired.
  const path = window.location.pathname;
  if (path === '/circles' || /^\/circles\/\d+$/.test(path)) return <DepartmentHub />;
  return <App />;
}

createRoot(document.getElementById('root')!, {
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <RootApp />
  </ErrorBoundary>,
);
