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

const common = (d) => ({ sb: d.sb, shop: d.shop, fail: d.fail, toast: d.toast, onShopChange: d.onShopChange });

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
export function NotifikasiView() { return <SalurTab {...common(useDash())} />; }
