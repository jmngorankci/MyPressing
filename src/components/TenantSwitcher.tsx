'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  Building2,
  ChevronDown,
  Plus,
  Check,
  Settings,
  Sparkles,
  MapPin,
  Coins,
  ShieldCheck,
} from 'lucide-react';
import { usePressingStore } from '@/lib/store';
import { CreateTenantModal } from './CreateTenantModal';

export function TenantSwitcher() {
  const {
    organizations,
    currentOrganization,
    currentOrgId,
    switchTenant,
  } = usePressingStore();

  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fermer le dropdown en cliquant à l'extérieur
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeColor = currentOrganization?.primary_color || '#2563eb';

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        {/* Bouton déclencheur du sélecteur */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 hover:border-slate-600 text-slate-100 text-xs transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 group"
          title="Changer d'établissement ou créer un nouveau pressing"
        >
          {/* Indicateur de couleur du pressing */}
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm transition-transform group-hover:scale-110"
            style={{ backgroundColor: activeColor }}
          />

          {/* Nom du pressing actif */}
          <span className="font-semibold text-white truncate max-w-[120px] sm:max-w-[160px] text-left">
            {currentOrganization?.name || 'Pressing Actif'}
          </span>

          {/* Badge devise */}
          <span className="hidden sm:inline-block text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-750 text-slate-300 border border-slate-700">
            {currentOrganization?.currency || 'FCFA'}
          </span>

          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-white' : ''
            }`}
          />
        </button>

        {/* Menu déroulant */}
        {isOpen && (
          <div className="absolute left-0 mt-2 w-72 sm:w-80 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl py-2 z-50 text-slate-100 animate-in fade-in zoom-in-95 duration-150">
            
            {/* Entête du menu */}
            <div className="px-4 py-2 border-b border-slate-800/80 flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-400" />
                Établissements ({organizations.length})
              </span>
              <span className="text-[10px] text-slate-500">Multi-Tenant SaaS</span>
            </div>

            {/* Liste des pressings */}
            <div className="max-h-64 overflow-y-auto py-1 divide-y divide-slate-800/40">
              {organizations.map((org) => {
                const isSelected = org.id === currentOrgId;
                const orgColor = org.primary_color || '#2563eb';

                return (
                  <button
                    key={org.id}
                    type="button"
                    onClick={() => {
                      switchTenant(org.id);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-3 transition-colors ${
                      isSelected
                        ? 'bg-blue-600/10 text-white'
                        : 'hover:bg-slate-800/60 text-slate-300 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                        style={{ backgroundColor: orgColor }}
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate text-white">{org.name}</p>
                        <p className="text-[11px] text-slate-400 truncate flex items-center gap-1">
                          <MapPin className="w-2.5 h-2.5 shrink-0" />
                          {org.address || 'Abidjan'}
                        </p>
                      </div>
                    </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {org.is_active === false || org.subscription_status === 'suspended' ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            Suspendu
                          </span>
                        ) : org.subscription_status === 'past_due' ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Retard
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                            {org.currency}
                          </span>
                        )}
                        {isSelected && (
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center text-white"
                            style={{ backgroundColor: orgColor }}
                          >
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Actions du bas */}
              <div className="p-2 pt-2 border-t border-slate-800/80 space-y-1">
                <Link
                  href="/admin"
                  onClick={() => setIsOpen(false)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 transition-all shadow-sm"
                >
                  <ShieldCheck className="w-4 h-4 text-white" />
                  Console Super Admin SaaS
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setIsModalOpen(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-800 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Créer un nouveau Pressing
                </button>

                <Link
                  href="/parametres"
                  onClick={() => setIsOpen(false)}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 transition-colors"
                >
                  <Settings className="w-3 h-3" />
                  Paramètres Blanchisserie
                </Link>
              </div>

          </div>
        )}
      </div>

      {/* Modal de création */}
      <CreateTenantModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={(name) => {
          // Callback optionnel
        }}
      />
    </>
  );
}
