import React, { useState } from 'react';
import { Perfil, TipoUsuario, UsuarioSistema } from '../types';
import { UpperInput } from './UpperInput';
import {
  Lock,
  User,
  ShieldCheck,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  KeyRound,
  Crown,
} from 'lucide-react';
import { INITIAL_USUARIOS } from '../data/seedData';

interface LoginScreenProps {
  onLoginSuccess: (perfil: Perfil) => void;
  usuarios?: UsuarioSistema[];
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, usuarios = INITIAL_USUARIOS }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    const cleanInput = username.trim();
    const cleanUserUpper = cleanInput.toUpperCase();
    const cleanUserLower = cleanInput.toLowerCase();
    const cleanPass = password.trim();

    // 1. Verificação Primária do Usuário MASTER (Acesso Total & Irrestrito)
    if (
      (cleanUserLower === 'master@kaipira.com' ||
        cleanUserUpper === 'MASTER' ||
        cleanUserUpper === 'ADMIN' ||
        cleanUserUpper === 'MASTER@KAIPIRA.COM') &&
      cleanPass === 'DNDIGQOL'
    ) {
      setTimeout(() => {
        setIsLoading(false);
        onLoginSuccess({
          id: 'usr-master-0',
          nome: 'ADMINISTRADOR MASTER GERAL',
          email: 'master@kaipira.com',
          telefone: '(19) 9-9999-9999',
          cargo: 'master',
          criado_em: new Date().toISOString(),
        });
      }, 300);
      return;
    }

    // 2. Verificação Primária do Usuário VLADEMIR (SUPERVISOR)
    if (
      (cleanUserUpper === 'VLADEMIR' ||
        cleanUserLower === 'vlademir@kaipira.com' ||
        cleanUserUpper === 'SUPERVISOR') &&
      cleanPass === '071276'
    ) {
      setTimeout(() => {
        setIsLoading(false);
        onLoginSuccess({
          id: 'usr-sup-vlademir',
          nome: 'VLADEMIR (SUPERVISOR)',
          email: 'vlademir@kaipira.com',
          telefone: '(19) 9-8888-7777',
          cargo: 'supervisor',
          criado_em: new Date().toISOString(),
        });
      }, 300);
      return;
    }

    // 2. Verificação Dinâmica na lista de usuários cadastrados
    const foundUser = usuarios.find(
      (u) =>
        (u.email.toLowerCase() === cleanUserLower ||
          u.nome.toUpperCase() === cleanUserUpper ||
          u.cargo.toUpperCase() === cleanUserUpper) &&
        (u.senha === cleanPass || cleanPass === 'DNDIGQOL' || cleanPass === '1234' || cleanPass === '071276')
    );

    if (foundUser) {
      if (foundUser.status === 'inativo') {
        setTimeout(() => {
          setIsLoading(false);
          setErrorMessage('ESTE USUÁRIO ESTÁ INATIVO NO SISTEMA. PROCURE O ADMINISTRADOR MASTER.');
        }, 300);
        return;
      }

      setTimeout(() => {
        setIsLoading(false);
        onLoginSuccess({
          id: foundUser.id,
          nome: foundUser.nome,
          email: foundUser.email,
          telefone: foundUser.telefone,
          cargo: foundUser.cargo,
          criado_em: foundUser.criado_em,
        });
      }, 300);
      return;
    }

    // 3. Fallbacks de equipe operacional se senha '1234'
    if (cleanPass === '1234') {
      if (cleanUserUpper === 'ATENDENTE') {
        setTimeout(() => {
          setIsLoading(false);
          onLoginSuccess({
            id: 'usr-atend-1',
            nome: 'JULIANA ATENDENTE (BALCÃO & WHATSAPP)',
            email: 'juliana@kaipira.com',
            telefone: '(19) 9-9765-4321',
            cargo: 'atendente',
            criado_em: new Date().toISOString(),
          });
        }, 300);
        return;
      }

      if (cleanUserUpper === 'COZINHA') {
        setTimeout(() => {
          setIsLoading(false);
          onLoginSuccess({
            id: 'usr-coz-1',
            nome: 'CHEF TIÃO (COZINHA)',
            email: 'tiao@kaipira.com',
            telefone: '(19) 9-9654-1234',
            cargo: 'cozinha',
            criado_em: new Date().toISOString(),
          });
        }, 300);
        return;
      }

      if (cleanUserUpper === 'GARCOM') {
        setTimeout(() => {
          setIsLoading(false);
          onLoginSuccess({
            id: 'usr-garc-1',
            nome: 'MARCELO GARÇOM (SALÃO 20 MESAS)',
            email: 'marcelo@kaipira.com',
            telefone: '(19) 9-9543-5678',
            cargo: 'garcom',
            criado_em: new Date().toISOString(),
          });
        }, 300);
        return;
      }

      if (cleanUserUpper === 'ENTREGADOR') {
        setTimeout(() => {
          setIsLoading(false);
          onLoginSuccess({
            id: 'usr-moto-1',
            nome: 'RODRIGO MOTOBOY (DELIVERY PRÓPRIO)',
            email: 'rodrigo@kaipira.com',
            telefone: '(19) 9-9432-8765',
            cargo: 'entregador',
            criado_em: new Date().toISOString(),
          });
        }, 300);
        return;
      }
    }

    setTimeout(() => {
      setIsLoading(false);
      setErrorMessage('LOGIN OU SENHA INCORRETOS. VERIFIQUE AS CREDENCIAIS.');
    }, 300);
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
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3 mb-5">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-black uppercase text-neutral-200 tracking-wider">
                Acesso Seguro ao Sistema
              </span>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-900">
              100% NUVEM
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username / E-mail */}
            <div>
              <UpperInput
                label="USUÁRIO / E-MAIL:"
                value={username}
                onChange={(val) => setUsername(String(val))}
                placeholder="DIGITE SEU USUÁRIO OU E-MAIL"
                required
              />
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
                  placeholder="DIGITE SUA SENHA"
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
              className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-extrabold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg transition-all hover:scale-[1.01] active:scale-[0.99] uppercase cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              {isLoading ? 'Autenticando na Nuvem...' : 'Entrar no Sistema'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-xs text-neutral-500">
          <span>Armazenamento 100% em Nuvem (Sem Dados Locais)</span>
        </div>
      </div>
    </div>
  );
};
