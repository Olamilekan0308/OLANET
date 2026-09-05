import { createRoot } from 'react-dom/client';
import App from './App';
import DepartmentHub from '@/components/department-hub';
import PeopleHub from '@/components/people-hub';
import SettingsHub from '@/components/settings-hub';
import ProfileHub from '@/components/profile-hub';
import MessagesHub from '@/components/messages-hub';
import { ErrorBoundary } from '@/components/error-boundary';
import './index.css';

function RootApp() {
  const path = window.location.pathname;
  if (path === '/circles' || /^\/circles\/\d+$/.test(path)) return <DepartmentHub />;
  if (path === '/people' || path === '/friends' || path === '/search') return <PeopleHub />;
  if (path === '/settings' || path === '/settings/account') return <SettingsHub />;
  if (path === '/profile') return <ProfileHub />;
  if (path === '/messages') return <MessagesHub />;
  return <App />;
}

createRoot(document.getElementById('root')!, { onCaughtError: (error, errorInfo) => console.error(error, errorInfo.componentStack) }).render(<ErrorBoundary><RootApp /></ErrorBoundary>);
