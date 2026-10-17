import DashShell from './DashShell';
import { getPublicConfig } from '@/lib/publicConfig';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Dashboard',
  robots: { index: false, follow: false },
  manifest: '/dashboard-manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Asisten Toko' },
  icons: { apple: '/pwa/icon-192.png' }
};

export default function DashboardLayout({ children }) {
  return <DashShell {...getPublicConfig()}>{children}</DashShell>;
}
