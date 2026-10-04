'use client';

import React from 'react';
import { usePressingStore } from '@/lib/store';

export default function ShopBrand() {
  const { settings } = usePressingStore();

  return (
    <span
      suppressHydrationWarning
      className="font-bold text-base sm:text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-blue-200 bg-clip-text text-transparent"
    >
      {settings.shop_name || 'Pressing Royal Ivoire'}
    </span>
  );
}
