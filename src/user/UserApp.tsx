import { Loader2 } from 'lucide-react';
import AuthForm from '@/components/AuthForm';
import BrandMark from '@/components/BrandMark';
import { useSession } from '@/hooks/useSession';
import UserDashboard from '@/user/UserDashboard';

export default function UserApp() {
  const { user, loading } = useSession();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-teal-700" aria-label="Loading" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-gradient-to-br from-teal-50 via-white to-slate-100 px-4 py-12">
        <BrandMark />
        <AuthForm
          title="Welcome to Grambo Seva Kendra"
          subtitle="Sign in to view your account and complete your identity verification."
        />
      </div>
    );
  }

  return <UserDashboard userId={user.uid} />;
}
