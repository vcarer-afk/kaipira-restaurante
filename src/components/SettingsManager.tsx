import React, { useState } from 'react';
import { ConfiguracoesSistema, PosicaoMenu, PadraoCor } from '../types';
import { THEMES } from '../utils/theme';
import { UpperInput } from './UpperInput';
import { consultarViaCep, cleanDigits } from '../utils/formatters';
import {
  supabase,
  saveConfiguracoesToSupabase,
  testarConexaoSupabase,
} from '../services/supabaseClient';
import {
  Settings,
  Database,
  Building2,
  Palette,
  Layout,
  Save,
  CheckCircle2,
  Cloud,
  Search,
  Check,
  RefreshCw,
  Mail,
  Phone,
  Clock,
  Sparkles,
} from 'lucide-react';

interface SettingsManagerProps {
  configuracoes: ConfiguracoesSistema;
  onSaveConfiguracoes: (novasConfiguracoes: ConfiguracoesSistema) => Promise<void>;
  onOpenSupabaseModal: () => void;
  onReloadCloudConfig?: () => Promise<void>;
  isCloudConfigLoading?: boolean;
  cloudConfigSyncedAt?: Date | null;
}

export const SettingsManager: React.FC<SettingsManagerProps> = ({
  configuracoes,
  onSaveConfiguracoes,
  onOpenSupabaseModal,
  onReloadCloudConfig,
  isCloudConfigLoading = false,
  cloudConfigSyncedAt,
}) => {
  const [formData, setFormData] = useState<ConfiguracoesSistema>(configuracoes);
  const [isSaving, setIsSaving] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isTestingDb, setIsTestingDb] = useState(false);
  const [dbTestMessage, setDbTestMessage] = useState<string | null>(null);
  const [isCepLoading, setIsCepLoading] = useState(false);

  // Sync state whenever configuracoes is updated from the cloud
  React.useEffect(() => {
    if (configuracoes) {
      setFormData(configuracoes);
    }
  }, [configuracoes]);

  const activeTheme = THEMES[formData.padraoCor] || THEMES.ambar;

  const handleBuscarCep = async () => {
    const digits = cleanDigits(formData.cep);
    if (digits.length !== 8) {
      alert('DIGITE UM CEP VÁLIDO COM 8 NÚMEROS');
      return;
    }

    setIsCepLoading(true);
    try {
      const data = await consultarViaCep(digits);
      if (data && !data.erro) {
        setFormData((prev) => ({
          ...prev,
          endereco: data.logradouro || prev.endereco,
          bairro: data.bairro || prev.bairro,
          cidade: data.localidade || 'PIRACICABA',
          uf: data.uf || 'SP',
        }));
      } else {
        alert('CEP NÃO LOCALIZADO NO VIACEP. PREENCHA MANUALMENTE.');
      }
    } catch {
      alert('FALHA AO CONSULTAR O VIACEP.');
    } finally {
      setIsCepLoading(false);
    }
  };

  const handleTestDatabase = async () => {
    setIsTestingDb(true);
    setDbTestMessage(null);
    try {
      const res = await testarConexaoSupabase(formData.supabaseUrl, formData.supabaseAnonKey);
      setDbTestMessage(res.message);
      if (res.success) {
        setFormData((prev) => ({ ...prev, bancoStatus: 'conectado' }));
      }
    } catch (err: any) {
      setDbTestMessage(`FALHA NA CONEXÃO SUPABASE: ${err.message}`);
    } finally {
      setIsTestingDb(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSavedSuccess(false);

    try {
      // 1. Save directly to Supabase cloud table 'configuracoes'
      const saved = await saveConfiguracoesToSupabase(formData);
      // 2. Propagate to parent state in memory
      await onSaveConfiguracoes(saved);

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err: any) {
      console.error('Erro ao salvar no Supabase:', err);
      const isMissingTable =
        err?.message?.includes('PGRST205') ||
        err?.message?.includes('schema cache') ||
        err?.message?.includes('Could not find the table') ||
        err?.code === 'PGRST205';

      if (isMissingTable) {
        // Still update local memory so the user doesn't lose their edits while creating the table
        await onSaveConfiguracoes(formData);
        onOpenSupabaseModal();
        alert(
          'TABELA "configuracoes" AINDA NÃO CRIADA NO SEU SUPABASE!\n\n' +
          'A tabela "configuracoes" não foi encontrada no seu banco Supabase. O script SQL foi aberto na tela:\n' +
          '1. Copie o script SQL exibido\n' +
          '2. Cole e execute no SQL Editor do seu projeto Supabase\n' +
          '3. Em seguida, clique em Salvar novamente!'
        );
      } else {
        alert(`FALHA AO SALVAR CONFIGURAÇÕES NO SUPABASE: ${err.message || 'Verifique as credenciais da nuvem'}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Settings Header */}
      <div className="bg-neutral-850 p-6 rounded-2xl border border-neutral-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-md">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase text-amber-500 tracking-wider mb-1">
            <Settings className="w-4 h-4 text-amber-500" />
            <span>PAINEL DO ADMINISTRADOR · CONFIGURAÇÕES DO SISTEMA</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase">
            Configurações Gerais, Banco de Dados e Layout
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Personalize informações do restaurante, endereço em Piracicaba, conexão cloud e layout
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {onReloadCloudConfig && (
            <button
              type="button"
              onClick={async () => {
                setIsReloading(true);
                try {
                  await onReloadCloudConfig();
                } finally {
                  setIsReloading(false);
                }
              }}
              disabled={isReloading || isCloudConfigLoading}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-neutral-300 bg-neutral-800 hover:bg-neutral-750 border border-neutral-700 flex items-center gap-2 shadow-sm transition-all uppercase"
              title="Recarrega as configurações diretamente salvas na nuvem"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isReloading || isCloudConfigLoading ? 'animate-spin text-cyan-400' : 'text-neutral-400'}`} />
              <span>{isReloading || isCloudConfigLoading ? 'Carregando Nuvem...' : 'Recarregar Nuvem'}</span>
            </button>
          )}

          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`px-5 py-2.5 rounded-xl text-xs font-extrabold text-white flex items-center gap-2 shadow-lg transition-transform hover:scale-105 active:scale-95 uppercase ${activeTheme.primaryBg} ${activeTheme.primaryHover}`}
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Gravando na Nuvem...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>

      {/* Cloud sync status indicator */}
      <div className="flex items-center justify-between px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-[11px] text-neutral-400">
        <div className="flex items-center gap-2">
          <Cloud className={`w-3.5 h-3.5 ${isCloudConfigLoading ? 'text-amber-400 animate-pulse' : 'text-cyan-400'}`} />
          <span className="font-semibold text-neutral-300">Sincronização em Nuvem:</span>
          <span>
            {isCloudConfigLoading
              ? 'Lendo configurações da nuvem...'
              : cloudConfigSyncedAt
              ? `Carregadas com sucesso às ${cloudConfigSyncedAt.toLocaleTimeString('pt-BR')}`
              : 'Configurações ativas carregadas do servidor em nuvem'}
          </span>
        </div>
        <span className="hidden sm:inline font-mono text-[10px] text-neutral-500 uppercase">
          Todos os dispositivos sincronizados via SSE Realtime
        </span>
      </div>

      {savedSuccess && (
        <div className="p-4 bg-emerald-950/80 border border-emerald-800 rounded-xl text-xs text-emerald-300 font-bold flex items-center gap-2 shadow-sm animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>Configurações atualizadas e gravadas com sucesso no servidor em nuvem!</span>
        </div>
      )}

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: BANCO DE DADOS & DADOS DO RESTAURANTE (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* BANCO DE DADOS (SUPABASE & CLOUD) */}
          <div className="bg-neutral-850 p-5 rounded-2xl border border-neutral-800 shadow-xs flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">
                  Banco de Dados & Armazenamento em Nuvem
                </h3>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                100% CLOUD (ZERO LOCALSTORAGE)
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-neutral-300 block mb-1">
                  URL DO PROJETO SUPABASE / POSTGRES:
                </label>
                <input
                  type="text"
                  value={formData.supabaseUrl}
                  onChange={(e) => setFormData({ ...formData, supabaseUrl: e.target.value })}
                  placeholder="https://seu-projeto.supabase.co"
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-neutral-100 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-300 block mb-1">
                  CHAVE PÚBLICA ANON / API KEY:
                </label>
                <input
                  type="password"
                  value={formData.supabaseAnonKey}
                  onChange={(e) => setFormData({ ...formData, supabaseAnonKey: e.target.value })}
                  placeholder="sb_anon_..."
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-neutral-100 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {dbTestMessage && (
                <div className="p-3 bg-neutral-900 border border-emerald-800/80 rounded-lg text-xs text-emerald-400 font-medium flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{dbTestMessage}</span>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleTestDatabase}
                  disabled={isTestingDb}
                  className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-750 text-neutral-200 border border-neutral-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTestingDb ? 'animate-spin' : ''}`} />
                  {isTestingDb ? 'Testando Conexão...' : 'Testar Conexão Cloud'}
                </button>

                <button
                  type="button"
                  onClick={onOpenSupabaseModal}
                  className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-750 text-emerald-400 border border-neutral-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Database className="w-3.5 h-3.5" />
                  Ver / Copiar SQL do Supabase
                </button>
              </div>
            </div>
          </div>

          {/* DADOS GERAIS DO RESTAURANTE */}
          <div className="bg-neutral-850 p-5 rounded-2xl border border-neutral-800 shadow-xs flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">
                  Dados do Restaurante & Endereço Completo
                </h3>
              </div>
              <span className="text-[10px] text-neutral-400 uppercase">
                Piracicaba - SP
              </span>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <UpperInput
                  label="NOME FANTASIA DO ESTABELECIMENTO: *"
                  value={formData.nomeRestaurante}
                  onChange={(val) => setFormData({ ...formData, nomeRestaurante: val })}
                  required
                />

                {/* E-mail (Email is the ONLY field that preserves lowercase casing per prompt) */}
                <div>
                  <label className="text-xs font-semibold tracking-wider text-neutral-300 block mb-1">
                    E-MAIL INSTITUCIONAL: *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-2.5 text-neutral-500" />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="contato@restaurantekaipira.com.br"
                      className="w-full pl-9 pr-3 py-2 bg-neutral-800 border border-neutral-700 text-neutral-100 rounded-lg text-sm transition-colors focus:outline-none focus:ring-1 focus:ring-amber-500"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <UpperInput
                  label="TELEFONE / WHATSAPP: *"
                  maskType="phone"
                  value={formData.telefone}
                  onChange={(val) => setFormData({ ...formData, telefone: val })}
                  placeholder="(19) 3-4221-1980"
                  required
                />

                <UpperInput
                  label="HORÁRIO DE FUNCIONAMENTO: *"
                  value={formData.horarioFuncionamento}
                  onChange={(val) => setFormData({ ...formData, horarioFuncionamento: val })}
                  placeholder="SEGUNDA A SÁBADO, DAS 11H ÀS 14H"
                  required
                />
              </div>

              {/* Endereço com busca ViaCEP */}
              <div className="p-3.5 bg-neutral-900 rounded-xl border border-neutral-800 space-y-3">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <UpperInput
                      label="CEP DO RESTAURANTE (PIRACICABA): *"
                      maskType="cep"
                      value={formData.cep}
                      onChange={(val) => setFormData({ ...formData, cep: val })}
                      placeholder="13400-010"
                      required
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleBuscarCep}
                    disabled={isCepLoading}
                    className="px-3 py-2 bg-neutral-800 hover:bg-neutral-750 text-amber-400 border border-neutral-700 rounded-lg text-xs font-bold flex items-center gap-1.5 h-[38px] shrink-0"
                  >
                    <Search className="w-3.5 h-3.5" />
                    {isCepLoading ? 'Buscando...' : 'ViaCEP'}
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <UpperInput
                      label="ENDEREÇO / LOGRADOURO: *"
                      value={formData.endereco}
                      onChange={(val) => setFormData({ ...formData, endereco: val })}
                      placeholder="RUA DO ROSÁRIO"
                      required
                    />
                  </div>
                  <div>
                    <UpperInput
                      label="NÚMERO: *"
                      value={formData.numero}
                      onChange={(val) => setFormData({ ...formData, numero: val })}
                      placeholder="1240"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <UpperInput
                      label="BAIRRO: *"
                      value={formData.bairro}
                      onChange={(val) => setFormData({ ...formData, bairro: val })}
                      placeholder="CENTRO"
                      required
                    />
                  </div>
                  <div>
                    <UpperInput
                      label="CIDADE: *"
                      value={formData.cidade}
                      onChange={(val) => setFormData({ ...formData, cidade: val })}
                      placeholder="PIRACICABA"
                      required
                    />
                  </div>
                  <div>
                    <UpperInput
                      label="UF: *"
                      value={formData.uf}
                      onChange={(val) => setFormData({ ...formData, uf: val })}
                      placeholder="SP"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: LAYOUT, POSIÇÃO DO MENU E PADRÕES DE CORES (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* POSIÇÃO DA BARRA DE MENUS */}
          <div className="bg-neutral-850 p-5 rounded-2xl border border-neutral-800 shadow-xs flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <Layout className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">
                  Posição da Barra de Menus
                </h3>
              </div>
              <span className="text-[10px] text-neutral-400 uppercase font-mono">
                {formData.posicaoMenu}
              </span>
            </div>

            <p className="text-xs text-neutral-400">
              Escolha onde o menu de navegação principal deve ser posicionado:
            </p>

            <div className="grid grid-cols-1 gap-2.5">
              {[
                {
                  id: 'direita' as PosicaoMenu,
                  label: 'À Direita (Slide Drawer)',
                  desc: 'Gaveta animada deslizando à direita com visual amplo para o salão e KDS',
                },
                {
                  id: 'esquerda' as PosicaoMenu,
                  label: 'À Esquerda (Slide Drawer)',
                  desc: 'Gaveta deslizando à esquerda no padrão ocidental de dashboards',
                },
                {
                  id: 'topo' as PosicaoMenu,
                  label: 'Acima (Barra Horizontal Superior)',
                  desc: 'Menu expandido fixo diretamente na barra superior para telas largas',
                },
              ].map((pos) => {
                const isSelected = formData.posicaoMenu === pos.id;
                return (
                  <button
                    key={pos.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, posicaoMenu: pos.id })}
                    className={`p-3 rounded-xl border text-left transition-all flex items-start justify-between gap-3 ${
                      isSelected
                        ? 'border-amber-500 bg-neutral-900 ring-1 ring-amber-500 shadow-sm'
                        : 'border-neutral-800 bg-neutral-900/60 hover:border-neutral-700'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-extrabold text-white uppercase block">
                        {pos.label}
                      </span>
                      <span className="text-[11px] text-neutral-400 block mt-0.5">
                        {pos.desc}
                      </span>
                    </div>
                    {isSelected && (
                      <span className="w-4 h-4 rounded-full bg-amber-500 text-neutral-950 flex items-center justify-center font-black text-[10px] shrink-0 mt-0.5">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* PADRÕES DE CORES CONFIGURÁVEIS (5 PALETAS) */}
          <div className="bg-neutral-850 p-5 rounded-2xl border border-neutral-800 shadow-xs flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-purple-400" />
                <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">
                  Padrões de Cores do Restaurante (5 Paletas)
                </h3>
              </div>
              <span className="text-[10px] font-mono text-purple-400">
                5 TEMAS
              </span>
            </div>

            <p className="text-xs text-neutral-400">
              Selecione o tema cromático que personaliza botões, destaques e cabeçalho:
            </p>

            <div className="space-y-2.5">
              {(Object.keys(THEMES) as PadraoCor[]).map((themeKey) => {
                const theme = THEMES[themeKey];
                const isSelected = formData.padraoCor === themeKey;

                return (
                  <button
                    key={themeKey}
                    type="button"
                    onClick={() => setFormData({ ...formData, padraoCor: themeKey })}
                    className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'border-neutral-400 bg-neutral-900 ring-2 ring-neutral-400 shadow-md'
                        : 'border-neutral-800 bg-neutral-900/60 hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Color Dot Swatch */}
                      <span
                        className="w-5 h-5 rounded-full shadow-xs shrink-0 border border-white/20"
                        style={{ backgroundColor: theme.dotColor }}
                      />
                      <div>
                        <span className="text-xs font-black text-white uppercase block leading-tight">
                          {theme.name}
                        </span>
                        <span className="text-[10px] text-neutral-400 block mt-0.5">
                          {theme.desc}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase"
                        style={{ backgroundColor: theme.dotColor }}
                      >
                        Amostra
                      </span>
                      {isSelected && (
                        <Check className="w-4 h-4 text-white shrink-0" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
