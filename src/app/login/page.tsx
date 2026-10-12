'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Sparkles,
  Lock,
  Mail,
  KeyRound,
  ShieldCheck,
  Building2,
  User,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Smartphone,
  Layers,
  Send,
  Zap,
  Phone,
  MapPin,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import { usePressingStore, UserSession } from '@/lib/store';
import { createClient as createSupabaseClient } from '@/lib/supabase/client';
import { MemberRole } from '@/types/database';

export default function LoginPage() {
  const router = useRouter();
  const {
    organizations,
    currentOrganization,
    currentUser,
    loginUser,
    logoutUser,
    createTenant,
    isOnline,
  } = usePressingStore();

  const [authMode, setAuthMode] = useState<'password' | 'magic_link' | 'register'>('password');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [shopName, setShopName] = useState('');
  const [phone, setPhone] = useState('+225 ');
  const [address, setAddress] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<'starter' | 'pro' | 'enterprise'>('pro');

  // Feedback states
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Vérifier si une session Supabase active existe au chargement
  useEffect(() => {
    async function checkSupabaseSession() {
      try {
        const supabase = createSupabaseClient();
        const { data } = await supabase.auth.getSession();
        if (data?.session?.user) {
          const user = data.session.user;
          // Vérifier si user a déjà un rôle
          loginUser({
            id: user.id,
            name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Utilisateur',
            email: user.email || '',
            role: (user.user_metadata?.role as MemberRole) || 'owner',
            isLoggedIn: true,
          });
        }
      } catch (err) {
        // Mode offline
      }
    }
    checkSupabaseSession();
  }, [loginUser]);

  // 1. Connexion standard (Email + Mot de passe)
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim() || !password.trim()) {
      setErrorMsg('Veuillez renseigner votre email et votre mot de passe.');
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createSupabaseClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) {
        // Si Supabase renvoie une erreur (ex: credentials invalides ou email non confirmé)
        // On propose une solution propre
        setErrorMsg(
          error.message === 'Invalid login credentials'
            ? 'Identifiants incorrects. Vérifiez votre email et mot de passe.'
            : `Erreur d'authentification : ${error.message}`
        );
        setIsLoading(false);
        return;
      }

      if (data?.user) {
        const user = data.user;
        const role = (user.user_metadata?.role as MemberRole) || 'owner';
        const userOrgId = user.user_metadata?.organization_id || currentOrganization?.id;

        loginUser(
          {
            id: user.id,
            name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Utilisateur',
            email: user.email || email,
            role,
            isLoggedIn: true,
          },
          userOrgId
        );

        setSuccessMsg('Connexion réussie ! Redirection...');
        setTimeout(() => {
          if (role === 'super_admin') router.push('/admin');
          else if (role === 'workshop') router.push('/atelier');
          else router.push('/');
        }, 1000);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erreur inattendue lors de la connexion.');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Connexion par Lien Magique (Magic Link sans mot de passe)
  const handleMagicLinkLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim()) {
      setErrorMsg('Veuillez saisir votre adresse email professionnelle.');
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createSupabaseClient();
      const redirectUrl = typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined;

      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) {
        setErrorMsg(`Erreur envoi Magic Link : ${error.message}`);
      } else {
        setSuccessMsg(
          `Un lien magique sécurisé a été envoyé à "${email}". Cliquez sur le lien dans votre boîte de réception pour vous connecter instantanément.`
        );
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erreur lors de l\'envoi du Magic Link.');
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Inscription & Création d'un nouveau compte gérant pressing
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim() || !password.trim() || !shopName.trim()) {
      setErrorMsg('Veuillez remplir au moins votre email, mot de passe et le nom de votre pressing.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Le mot de passe doit comporter au moins 6 caractères.');
      return;
    }

    setIsLoading(true);

    try {
      // Créer le tenant d'abord dans l'application
      const newTenant = await createTenant({
        name: shopName.trim(),
        phone: phone.trim() || '+225 07 00 00 00 00',
        email: email.trim(),
        address: address.trim() || 'Abidjan, Côte d\'Ivoire',
        currency: 'FCFA',
        seedCatalog: true,
      });

      const supabase = createSupabaseClient();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
        options: {
          data: {
            full_name: fullName.trim() || shopName.trim(),
            role: 'owner',
            organization_id: newTenant.id,
            shop_name: shopName.trim(),
          },
        },
      });

      if (error) {
        setErrorMsg(`Erreur création compte Supabase : ${error.message}`);
        setIsLoading(false);
        return;
      }

      // Connexion locale immédiate
      loginUser(
        {
          id: data.user?.id || `usr-${Date.now()}`,
          name: fullName.trim() || shopName.trim(),
          email: email.trim(),
          role: 'owner',
          isLoggedIn: true,
          organization_id: newTenant.id,
        },
        newTenant.id
      );

      setSuccessMsg(`Votre établissement "${shopName}" a été configuré avec succès ! Bienvenue sur MyPressing.`);
      setTimeout(() => {
        router.push('/');
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erreur inattendue lors de l\'inscription.');
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Démo Express 1-Clic
  const handleQuickDemoLogin = (
    role: MemberRole,
    demoName: string,
    demoEmail: string,
    targetOrgId?: string,
    redirectPath: string = '/'
  ) => {
    const orgId = targetOrgId || currentOrganization?.id || organizations[0]?.id;

    loginUser(
      {
        id: `demo-${role}`,
        name: demoName,
        email: demoEmail,
        role,
        isLoggedIn: true,
        organization_id: orgId,
      },
      orgId
    );

    setSuccessMsg(`Connecté avec succès en tant que : ${demoName} (${role}).`);
    setTimeout(() => {
      router.push(redirectPath);
    }, 500);
  };

  const primaryColor = currentOrganization?.primary_color || '#2563eb';

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-center items-center p-4 sm:p-6 bg-slate-950 text-slate-100 relative overflow-hidden">
      {/* Background Glows */}
      <div
        className="absolute -top-40 -left-40 w-96 h-96 rounded-full blur-[120px] opacity-25 pointer-events-none"
        style={{ backgroundColor: primaryColor }}
      />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-600 rounded-full blur-[120px] opacity-20 pointer-events-none" />

      <div className="w-full max-w-xl relative z-10">
        
        {/* En-tête / Logo */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl shadow-xl text-white mb-4"
            style={{ backgroundColor: primaryColor }}
          >
            <Sparkles className="w-7 h-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Portail d'Accès Sécurisé
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
            Connectez-vous à votre espace blanchisserie ou accédez à la console de pilotage multi-tenant.
          </p>

          {/* Indicateur de tenant courant */}
          {currentOrganization && (
            <div className="inline-flex items-center gap-2 mt-3 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-300">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: primaryColor }}
              />
              <span>Établissement actif : <strong>{currentOrganization.name}</strong></span>
            </div>
          )}
        </div>

        {/* Si l'utilisateur est déjà connecté */}
        {currentUser && currentUser.isLoggedIn && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 mb-6 backdrop-blur-xl shadow-xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0 font-bold">
                {currentUser.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-400">Actuellement connecté</p>
                <p className="text-sm font-bold text-white truncate">{currentUser.name}</p>
                <span className="text-[10px] uppercase font-bold px-2 py-0.2 rounded bg-slate-800 text-blue-400 border border-slate-700">
                  {currentUser.role}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link
                href={currentUser.role === 'super_admin' ? '/admin' : '/'}
                className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors"
              >
                Mon Espace
              </Link>
              <button
                onClick={() => logoutUser()}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-rose-400 transition-colors"
                title="Se déconnecter"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Carte Principale d'Authentification */}
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-6">
          
          {/* Onglets de Connexion */}
          <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800/80">
            <button
              type="button"
              onClick={() => {
                setAuthMode('password');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                authMode === 'password'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              Mot de passe
            </button>

            <button
              type="button"
              onClick={() => {
                setAuthMode('magic_link');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                authMode === 'magic_link'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              Lien Magique
            </button>

            <button
              type="button"
              onClick={() => {
                setAuthMode('register');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                authMode === 'register'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              Nouveau Pressing
            </button>
          </div>

          {/* Feedback Messages */}
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* 1. Formulaire Email + Mot de passe */}
          {authMode === 'password' && (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Adresse Email Professionnelle
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    required
                    placeholder="gerant@pressing-royal.ci"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Mot de passe
                  </label>
                  <button
                    type="button"
                    onClick={() => setAuthMode('magic_link')}
                    className="text-[11px] text-blue-400 hover:underline"
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-white text-xs sm:text-sm shadow-lg shadow-blue-900/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? 'Connexion en cours...' : 'Se Connecter à la Plateforme'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* 2. Formulaire Lien Magique (Magic Link) */}
          {authMode === 'magic_link' && (
            <form onSubmit={handleMagicLinkLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Votre Adresse Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    required
                    placeholder="contact@votre-pressing.ci"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Nous vous enverrons un lien à usage unique par email pour vous connecter sans saisir de mot de passe.
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 font-bold text-white text-xs sm:text-sm shadow-lg shadow-blue-900/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? 'Envoi du lien...' : 'Recevoir mon Lien Magique de Connexion'}
                <Send className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* 3. Formulaire d'Inscription Nouveau Pressing */}
          {authMode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Nom du Gérant
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Koffi Roland"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Téléphone Guichet / WhatsApp
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="+225 07 00 00 00 00"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nom Commercial du Pressing / Blanchisserie
                </label>
                <input
                  type="text"
                  required
                  placeholder="Pressing Soleil d'Ivoire"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Email de Connexion
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="contact@soleil-ivoire.ci"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Mot de passe
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Au moins 6 caractères"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Adresse & Ville
                </label>
                <input
                  type="text"
                  placeholder="Cocody Angré 8ème Tranche, Abidjan"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-white text-xs sm:text-sm shadow-lg shadow-emerald-900/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
              >
                {isLoading ? 'Configuration de votre pressing...' : 'Créer Mon Pressing & Commencer l\'Essai'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* Section 4 : Démo Express & Accès Rapide par Rôle */}
          <div className="pt-4 border-t border-slate-800/80">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Accès Immédiat 1-Clic (Comptes Démo)
              </span>
              <span className="text-[10px] text-slate-500">Test & Simulation</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  handleQuickDemoLogin(
                    'super_admin',
                    'Super Admin SaaS',
                    'admin@mypressing.ci',
                    undefined,
                    '/admin'
                  )
                }
                className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-indigo-900/40 hover:border-indigo-500/50 text-left transition-all group"
              >
                <div className="flex items-center gap-1.5 text-indigo-400 font-bold text-xs mb-0.5">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>Super Admin</span>
                </div>
                <p className="text-[10px] text-slate-400 truncate">Gestion plateforme & tenants</p>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleQuickDemoLogin(
                    'owner',
                    'Gérant Pressing',
                    'direction@pressing-royal.ci',
                    organizations[0]?.id,
                    '/'
                  )
                }
                className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-blue-900/40 hover:border-blue-500/50 text-left transition-all group"
              >
                <div className="flex items-center gap-1.5 text-blue-400 font-bold text-xs mb-0.5">
                  <User className="w-3.5 h-3.5 shrink-0" />
                  <span>Gérant Pressing</span>
                </div>
                <p className="text-[10px] text-slate-400 truncate">Plein contrôle magasin</p>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleQuickDemoLogin(
                    'cashier',
                    'Caissière Awa',
                    'caisse@pressing-royal.ci',
                    organizations[0]?.id,
                    '/caisse'
                  )
                }
                className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-emerald-900/40 hover:border-emerald-500/50 text-left transition-all group"
              >
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs mb-0.5">
                  <Smartphone className="w-3.5 h-3.5 shrink-0" />
                  <span>Caissier Guichet</span>
                </div>
                <p className="text-[10px] text-slate-400 truncate">Prise commandes & paiements</p>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleQuickDemoLogin(
                    'workshop',
                    'Opérateur Repassage',
                    'atelier@pressing-royal.ci',
                    organizations[0]?.id,
                    '/atelier'
                  )
                }
                className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-purple-900/40 hover:border-purple-500/50 text-left transition-all group"
              >
                <div className="flex items-center gap-1.5 text-purple-400 font-bold text-xs mb-0.5">
                  <Layers className="w-3.5 h-3.5 shrink-0" />
                  <span>Buandier Atelier</span>
                </div>
                <p className="text-[10px] text-slate-400 truncate">Kanban & linge prêt</p>
              </button>
            </div>
          </div>

        </div>

        {/* Pied de page */}
        <div className="text-center mt-6 text-xs text-slate-500 space-y-1">
          <p>MyPressing B2B SaaS • Multi-Tenant avec Isolation RLS & Mode Hors-ligne</p>
          <div className="flex items-center justify-center gap-3 text-slate-400">
            <Link href="/" className="hover:underline">
              Retour au Guichet
            </Link>
            <span>•</span>
            <Link href="/admin" className="hover:underline">
              Console Super Admin
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
