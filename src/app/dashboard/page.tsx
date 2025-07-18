import { DashboardClient } from '@/components/dashboard/dashboard-client';
import { Header } from '@/components/dashboard/header';

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header />
      <main className="flex flex-1 flex-col gap-4 p-4 sm:p-6 md:gap-8">
        <DashboardClient />
      </main>
    </div>
  );
}
