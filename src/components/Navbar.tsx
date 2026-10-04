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
import { usePressingStore } from '@/lib/store';

export function Navbar() {
  const pathname = usePathname();
  const [isMounted, setIsMounted] = React.useState(false);
  const {
    settings,
    orders,
    isOnline,
    isSyncing,
    pendingSyncCount,
    lastSyncTime,
    triggerSync,
  } = usePressingStore();

  const [mountedShopName, setMountedShopName] = React.useState<string | null>(null);

  React.useEffect(() => {
    setIsMounted(true);
    if (settings?.shop_name) {
      setMountedShopName(settings.shop_name);
    }
  }, [settings?.shop_name]);

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
      label: 'Tarifs & Paramètres',
      icon: Settings,
      badge: null,
    },
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 text-slate-100 shadow-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Pressing Info */}
          <Link href="/" className="flex items-center gap-3 group focus:outline-none">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/25 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span
                  suppressHydrationWarning
                  className="font-bold text-base sm:text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-blue-200 bg-clip-text text-transparent"
                >
                  {mountedShopName || 'Pressing & Blanchisserie Le Majestueux'}
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  PWA
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Caisse Tactile & Atelier Hors-ligne
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
                  className={`relative flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="hidden md:inline">{item.label}</span>
                  {item.badge !== null && (
                    <span
                      className={`text-[11px] font-bold px-1.5 py-0.2 rounded-full text-white ${
                        item.badgeColor || (isActive ? 'bg-blue-900 text-blue-100' : 'bg-blue-600')
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
