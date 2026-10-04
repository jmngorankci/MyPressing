'use client';

import React from 'react';
import { usePressingStore } from '@/lib/store';

export default function ShopBrand() {
  const { settings } = usePressingStore();

  return (
    <span
      suppressHydrationWarning
      className="font-bold text-base sm:text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-200 bg-clip-text text-transparent truncate max-w-[200px] sm:max-w-xs"
    >
      {settings.shop_name || 'Pressing Royal Ivoire'}
    </span>
  );
}
