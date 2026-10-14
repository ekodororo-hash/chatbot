'use client';
import { createContext, useContext } from 'react';

// Data yang dipakai bersama semua halaman admin layanan (diisi oleh AdminShell).
export const AdminCtx = createContext(null);
export const useAdmin = () => useContext(AdminCtx);
