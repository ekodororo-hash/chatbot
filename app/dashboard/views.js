'use client';
/* Penghubung antara halaman (route) dan komponen tab: mengambil data bersama dari DashShell. */
import { Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useDash } from './context';
import { SkConvRows } from '../components/Skeleton';
import ChatTab from './ChatTab';
import ProdukTab from './ProdukTab';
import FaqTab from './FaqTab';
import TokoTab from './TokoTab';
import PasangTab from './PasangTab';
import SalurTab from './SalurTab';
import AdminNotif from './AdminNotif';
import TimTab from './TimTab';
import LanggananTab from './LanggananTab';
import RingkasanTab from './RingkasanTab';
import PesananTab from './PesananTab';
import BelumTab from './BelumTab';
import KontakTab from './KontakTab';
import MulaiTab from './MulaiTab';

const common = (d) => ({ sb: d.sb, shop: d.shop, user: d.user, role: d.role, fail: d.fail, toast: d.toast, onShopChange: d.onShopChange, onShopDeleted: d.onShopDeleted, refreshBadges: d.refreshBadges });

export function ChatView() {
  const d = useDash();
  const router = useRouter();
  return (
    <Suspense fallback={<div className="card"><SkConvRows rows={4} /></div>}>
      <ChatTab {...common(d)} onHumanCount={d.setHumanCount} refreshHumanCount={d.refreshHumanCount}
        onMakeFaq={(q) => { d.setPrefillQ(q); router.push('/dashboard/faq'); }} />
    </Suspense>
  );
}
export function ProdukView() { return <ProdukTab {...common(useDash())} />; }
export function FaqView() {
  const d = useDash();
  return <FaqTab {...common(d)} prefillQ={d.prefillQ} onPrefillUsed={() => d.setPrefillQ('')} />;
}
export function TokoView() { return <TokoTab {...common(useDash())} />; }
export function PasangView() { return <PasangTab {...common(useDash())} />; }
export function NotifikasiView() {
  const c = common(useDash());
  return (
    <>
      <AdminNotif {...c} />
      <SalurTab {...c} />
    </>
  );
}
export function TimView() { return <TimTab {...common(useDash())} />; }
export function LanggananView() {
  return (
    <Suspense fallback={<div className="card"><SkConvRows rows={2} /></div>}>
      <LanggananTab {...common(useDash())} />
    </Suspense>
  );
}

export function RingkasanView() {
  const d = useDash();
  const router = useRouter();
  return <RingkasanTab {...common(d)} onMakeFaq={(q) => { d.setPrefillQ(q); router.push('/dashboard/faq'); }} />;
}
export function KontakView() { return <KontakTab {...common(useDash())} />; }
export function PesananView() { return <PesananTab {...common(useDash())} />; }
export function BelumView() {
  const d = useDash();
  const router = useRouter();
  return <BelumTab {...common(d)} onMakeFaq={(q) => { d.setPrefillQ(q); router.push('/dashboard/faq'); }} />;
}
export function MulaiView() { return <MulaiTab {...common(useDash())} />; }
