import Dashboard from './Dashboard';
import { getPublicConfig } from '@/lib/publicConfig';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Dashboard', robots: { index: false, follow: false } };

export default function DashboardPage() {
  return <Dashboard {...getPublicConfig()} />;
}
