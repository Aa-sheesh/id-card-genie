import { AdminClient } from '@/components/admin/admin-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminPage() {
  return (
    <div>
        <Card>
            <CardHeader>
                <CardTitle className="font-headline">Admin Dashboard</CardTitle>
                <CardDescription>Manage schools and their ID card templates.</CardDescription>
            </CardHeader>
            <CardContent>
                <AdminClient />
            </CardContent>
        </Card>
    </div>
  );
}
