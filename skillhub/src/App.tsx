import { AuthProvider, useAuth } from '@/lib/auth';
import { AuthScreen } from '@/components/auth-screen';
import { OLANETSocial } from './OLANETSocial';

function AppContent(){
  const { status } = useAuth();
  if(status === 'loading') return <div className="flex min-h-screen items-center justify-center bg-[#f0f2f5] text-[#65676b]">Loading OLANET…</div>;
  if(status === 'unauthenticated') return <AuthScreen />;
  return <OLANETSocial />;
}

export default function App(){
  return <AuthProvider><AppContent /></AuthProvider>;
}
