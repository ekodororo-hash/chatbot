'use client';
import { createContext, useContext } from 'react';

// Data yang dipakai bersama semua halaman dashboard (diisi oleh DashShell).
export const DashCtx = createContext(null);
export const useDash = () => useContext(DashCtx);
