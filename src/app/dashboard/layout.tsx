import type { Metadata } from 'next';
import AuthGuard from '@/components/auth-guard';
import { Header } from '@/components/dashboard/header';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Manage your ID card templates and generate student ID cards efficiently.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen w-full flex-col">
        <Header />
        <main className="flex flex-1 flex-col gap-4 p-4 sm:p-6 md:gap-8">
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
