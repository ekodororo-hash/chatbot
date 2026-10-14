import AdminShell from './AdminShell';
import { getPublicConfig } from '@/lib/publicConfig';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin layanan', robots: { index: false, follow: false } };

export default function AdminLayout({ children }) {
  return <AdminShell {...getPublicConfig()}>{children}</AdminShell>;
}
