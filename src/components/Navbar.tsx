'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sparkles,
  ShoppingBag,
  Kanban,
  Receipt,
  Settings,
  Wifi,
  WifiOff,
  RefreshCw,
  Clock,
  Layers,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { usePressingStore } from '@/lib/store';

const ShopBrand = dynamic(() => import('@/components/ShopBrand'), {
  ssr: false,
  loading: () => (
    <span className="font-bold text-base sm:text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-blue-200 bg-clip-text text-transparent">
      Pressing Royal Ivoire
    </span>
  ),
});

export function Navbar() {
  const pathname = usePathname();
  const [isMounted, setIsMounted] = React.useState(false);
  const {
    orders,
    settings,
    isOnline,
    isSyncing,
    pendingSyncCount,
    lastSyncTime,
    triggerSync,
  } = usePressingStore();

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const primaryColor = (isMounted && settings?.primary_color) ? settings.primary_color : '#2563eb';

  // Compter les commandes par statut (sécurisé après montage)
  const activeOrdersCount = isMounted
    ? orders.filter(
        (o) => o.status === 'to_process' || o.status === 'in_progress' || o.status === 'ready'
      ).length
    : 0;

  const readyOrdersCount = isMounted
    ? orders.filter((o) => o.status === 'ready').length
    : 0;

  const navItems = [
    {
      href: '/',
      label: 'Guichet Réception',
      icon: ShoppingBag,
      badge: null,
    },
    {
      href: '/atelier',
      label: 'Atelier Kanban',
      icon: Kanban,
      badge: activeOrdersCount > 0 ? activeOrdersCount : null,
    },
    {
      href: '/caisse',
      label: 'Caisse & Retrait',
      icon: Receipt,
      badge: readyOrdersCount > 0 ? readyOrdersCount : null,
      badgeColor: 'bg-emerald-500',
    },
    {
      href: '/parametres',
      label: 'Paramètres Blanchisserie',
      icon: Settings,
      badge: null,
    },
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-slate-100 shadow-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Pressing Info */}
          <Link href="/" className="flex items-center gap-3 group focus:outline-none">
            {isMounted && settings?.logo_url ? (
              <div 
                className="w-10 h-10 rounded-xl overflow-hidden bg-white/5 p-0.5 border flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform"
                style={{ borderColor: `${primaryColor}60` }}
              >
                <img
                  src={settings.logo_url}
                  alt={settings.shop_name || 'Logo'}
                  className="w-full h-full object-contain rounded-lg"
                />
              </div>
            ) : (
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform text-white"
                style={{
                  backgroundColor: primaryColor,
                  boxShadow: `0 8px 16px -2px ${primaryColor}40`,
                }}
              >
                <Sparkles className="w-5 h-5 text-white" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <ShopBrand />
                <span 
                  className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border transition-colors"
                  style={{
                    backgroundColor: `${primaryColor}15`,
                    borderColor: `${primaryColor}40`,
                    color: primaryColor,
                  }}
                >
                  SaaS B2B
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block truncate max-w-[220px]">
                {isMounted && settings?.address ? settings.address : 'Caisse Tactile & Atelier Multi-Tenant'}
              </p>
            </div>
          </Link>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 sm:gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={isActive ? { backgroundColor: primaryColor, boxShadow: `0 8px 16px -2px ${primaryColor}40` } : undefined}
                  className={`relative flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                    isActive
                      ? 'text-white'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="hidden md:inline">{item.label}</span>
                  {item.badge !== null && (
                    <span
                      className={`text-[11px] font-bold px-1.5 py-0.2 rounded-full text-white ${
                        item.badgeColor || (isActive ? 'bg-black/30 text-white' : 'bg-blue-600')
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Online/Offline Status & Sync Button */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => triggerSync()}
              disabled={isSyncing}
              title={
                isOnline
                  ? `Connecté à Supabase. ${pendingSyncCount} en attente.`
                  : 'Mode Hors-ligne (Stockage local actif)'
              }
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                isOnline
                  ? pendingSyncCount > 0
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              {isOnline ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <Wifi className="w-3.5 h-3.5 hidden sm:inline" />
                  <span className="hidden lg:inline">
                    {pendingSyncCount > 0 ? `${pendingSyncCount} en attente` : 'Supabase En Ligne'}
                  </span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-rose-400" />
                  <span className="hidden sm:inline text-rose-300">Hors-ligne</span>
                  {pendingSyncCount > 0 && (
                    <span className="bg-rose-500/30 px-1 rounded text-[10px]">
                      {pendingSyncCount}
                    </span>
                  )}
                </>
              )}

              <RefreshCw
                className={`w-3.5 h-3.5 ml-1 text-slate-400 hover:text-white ${
                  isSyncing ? 'animate-spin text-blue-400' : ''
                }`}
              />
            </button>
          </div>

        </div>
      </div>
    </header>
  );
}
