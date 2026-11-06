import React, { useState } from 'react';
import { Perfil, TipoUsuario, DEFAULT_RESTAURANTE_ID } from '../types';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  KeyRound,
  ShieldCheck,
} from 'lucide-react';
import {
  loginWithSupabase,
  setActiveRestauranteId,
  fetchRestauranteAtualSupabase,
  supabase,
} from '../services/supabaseClient';

interface LoginScreenProps {
  onLoginSuccess?: (perfil: Perfil) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    const cleanInput = username.trim();
    const cleanPass = password; // Senha case-sensitive (não aplicar toUpperCase)

    try {
      const data = await loginWithSupabase(cleanInput, cleanPass);
      const userEmail = (
        data.user?.email ||
        (cleanInput.includes('@') ? cleanInput.toLowerCase() : `${cleanInput.toLowerCase()}@kaipira.com`)
      ).toLowerCase();

      // Busca dados cadastrais e restaurante_id do usuário em usuarios_sistema ou usuarios
      let userRestauranteId: string = DEFAULT_RESTAURANTE_ID;
      let cargoAferido: TipoUsuario = 'atendente';
      let nomeUsuario: string = userEmail.split('@')[0].toUpperCase();

      try {
        // Tenta buscar primeiro na tabela usuarios_sistema
        const { data: usrSis } = await supabase
          .from('usuarios_sistema')
          .select('id, nome, email, perfil, restaurante_id, ativo')
          .eq('email', userEmail)
          .maybeSingle();

        if (usrSis) {
          if (usrSis.restaurante_id) userRestauranteId = usrSis.restaurante_id;
          if (usrSis.nome) nomeUsuario = usrSis.nome.toUpperCase();
          if (usrSis.perfil === 'admin') cargoAferido = 'admin';
          else if (usrSis.perfil === 'supervisor') cargoAferido = 'supervisor';
          else if (usrSis.perfil === 'cozinha') cargoAferido = 'cozinha';
          else if (usrSis.perfil === 'garcom') cargoAferido = 'garcom';
          else if (usrSis.perfil === 'entregador') cargoAferido = 'entregador';
        } else {
          // Tenta buscar na tabela usuarios
          const { data: usrTab } = await supabase
            .from('usuarios')
            .select('id, nome, email, cargo, restaurante_id, status')
            .eq('email', userEmail)
            .maybeSingle();

          if (usrTab) {
            if (usrTab.restaurante_id) userRestauranteId = usrTab.restaurante_id;
            if (usrTab.nome) nomeUsuario = usrTab.nome.toUpperCase();
            if (usrTab.cargo) cargoAferido = usrTab.cargo as TipoUsuario;
          }
        }
      } catch (findErr) {
        console.warn('Aviso ao consultar tenant do usuário no Supabase:', findErr);
      }

      // Se não encontrou cargo específico na tabela, aplica o fallback por email
      if (cargoAferido === 'atendente') {
        if (userEmail.startsWith('admin') || userEmail.startsWith('master')) cargoAferido = 'admin';
        else if (userEmail.startsWith('vlademir') || userEmail.startsWith('supervisor')) cargoAferido = 'supervisor';
        else if (userEmail.startsWith('cozinha')) cargoAferido = 'cozinha';
        else if (userEmail.startsWith('garcom')) cargoAferido = 'garcom';
        else if (userEmail.startsWith('entregador')) cargoAferido = 'entregador';
      }

      const isSuperAdmin =
        userEmail === 'admin@kaipira.com' ||
        userEmail === 'master@kaipira.com' ||
        cargoAferido === 'master';

      // Validação de bloqueio/inatividade do restaurante/tenant
      if (!isSuperAdmin) {
        const tenant = await fetchRestauranteAtualSupabase(userRestauranteId);
        if (tenant && (tenant.ativo === false || tenant.status_assinatura === 'bloqueado')) {
          await supabase.auth.signOut().catch(() => {});
          setErrorMessage('O acesso desta empresa encontra-se temporariamente suspenso. Entre em contato com o suporte administrativo.');
          return;
        }
      }

      // Atualiza o tenant ativo em memória imediatamente
      setActiveRestauranteId(userRestauranteId);

      const perfil: Perfil = {
        id: data.user?.id || 'usr-' + Date.now(),
        nome: nomeUsuario,
        email: userEmail,
        cargo: cargoAferido,
        restaurante_id: userRestauranteId,
        criado_em: new Date().toISOString(),
      };

      if (onLoginSuccess) {
        onLoginSuccess(perfil);
      }
    } catch (err: any) {
      console.warn('Erro no login Supabase Auth:', err);
      const rawMsg = err.message || '';
      if (
        rawMsg.toLowerCase().includes('invalid login credentials') ||
        rawMsg.toLowerCase().includes('invalid_grant') ||
        rawMsg.toLowerCase().includes('invalid credentials')
      ) {
        setErrorMessage('Credenciais inválidas. Verifique o usuário e a senha digitada.');
      } else if (rawMsg.toLowerCase().includes('email not confirmed')) {
        setErrorMessage('E-mail não confirmado no Supabase.');
      } else {
        setErrorMessage(err.message || 'Erro ao autenticar no Supabase. Verifique suas credenciais.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-neutral-900 border-2 border-amber-500/50 mb-3 shadow-2xl p-1 overflow-hidden">
            <img
              src="./logo.png"
              alt="Restaurante Kaipira"
              className="w-full h-full object-contain rounded-full drop-shadow-md"
            />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white uppercase">
            Restaurante Kaipira
          </h1>
          <p className="text-xs text-neutral-400 mt-1 uppercase font-medium">
            Piracicaba - SP · Sistema de Gestão & Delivery Próprio
          </p>
        </div>

        {/* Login Box */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-md">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username / E-mail */}
            <div>
              <label className="text-xs font-semibold tracking-wider text-neutral-300 block mb-1">
                USUÁRIO OU E-MAIL:
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-2.5 text-neutral-500" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ex: admin, garcom ou seu email"
                  autoComplete="username"
                  className="w-full pl-9 pr-3 py-2 bg-neutral-800 border border-neutral-700 text-neutral-100 rounded-lg text-sm transition-colors focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder:text-neutral-500"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-xs font-semibold tracking-wider text-neutral-300 block mb-1">
                SENHA DE ACESSO:
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-2.5 text-neutral-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  autoComplete="current-password"
                  className="w-full pl-9 pr-10 py-2 bg-neutral-800 border border-neutral-700 text-neutral-100 rounded-lg text-sm transition-colors focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder:text-neutral-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-neutral-400 mt-1.5 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>Senha padrão da equipe com 6 dígitos (ex: 123456). Diferencia maiúsculas e minúsculas.</span>
              </p>
            </div>

            {/* Error banner */}
            {errorMessage && (
              <div className="p-3 bg-red-950/80 border border-red-800 rounded-lg text-xs text-red-300 flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-extrabold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg transition-all hover:scale-[1.01] active:scale-[0.99] uppercase cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <LogIn className="w-4 h-4" />
              {isLoading ? 'Autenticando no Supabase...' : 'Entrar no Sistema'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-xs text-neutral-500">
          <span>Autenticação Oficial Supabase Auth · 100% Nuvem</span>
        </div>
      </div>
    </div>
  );
};
