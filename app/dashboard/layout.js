import DashShell from './DashShell';
import { getPublicConfig } from '@/lib/publicConfig';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Dashboard', robots: { index: false, follow: false } };

export default function DashboardLayout({ children }) {
  return <DashShell {...getPublicConfig()}>{children}</DashShell>;
}
