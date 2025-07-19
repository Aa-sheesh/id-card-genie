import type { Metadata } from 'next';
import AdminAuthGuard from '@/components/admin/admin-auth-guard';
import { Header } from '@/components/dashboard/header';

export const metadata: Metadata = {
  title: 'Admin Dashboard',
  description: 'Administrative panel for managing schools and ID card templates.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthGuard>
      <div className="flex min-h-screen w-full flex-col">
        <Header />
        <main className="flex flex-1 flex-col gap-4 p-4 sm:p-6 md:gap-8">
          {children}
        </main>
      </div>
    </AdminAuthGuard>
  );
}
