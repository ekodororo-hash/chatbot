import LoginForm from './LoginForm';
import { getPublicConfig } from '@/lib/publicConfig';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Masuk' };

export default function LoginPage() {
  return <LoginForm {...getPublicConfig()} />;
}
