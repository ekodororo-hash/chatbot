import AdminClient from './AdminClient';
import { getPublicConfig } from '@/lib/publicConfig';

export const dynamic = 'force-dynamic';

export default function AdminPage() {
  return <AdminClient {...getPublicConfig()} />;
}
