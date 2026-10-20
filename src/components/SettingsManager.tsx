import React, { useState } from 'react';
import { ConfiguracoesSistema, PosicaoMenu, PadraoCor } from '../types';
import { THEMES } from '../utils/theme';
import { UpperInput } from './UpperInput';
import { consultarViaCep, cleanDigits } from '../utils/formatters';
import { supabase } from '../lib/supabase';
import {
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
  Copy,
  Code2,
} from 'lucide-react';

interface SettingsManagerProps {
  configuracoes: ConfiguracoesSistema;
  onSaveConfiguracoes: (novasConfiguracoes: ConfiguracoesSistema) => Promise<void>;
  onOpenSupabaseModal?: () => void;
  onReloadCloudConfig?: () => Promise<void>;
  isCloudConfigLoading?: boolean;
  cloudConfigSyncedAt?: Date | null;
}

const SUPABASE_SCHEMA_SQL = `-- =========================================================================
-- SUPABASE POSTGRESQL SCHEMA COMPLETO - RESTAURANTE KAIPIRA (PIRACICABA - SP)
-- Execute no SQL Editor do seu projeto Supabase (https://app.supabase.com)
-- =========================================================================

-- 1. TIPOS ENUM
DO $$ BEGIN
    CREATE TYPE tipo_usuario AS ENUM ('master', 'admin', 'atendente', 'cozinha', 'garcom', 'entregador');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TYPE tipo_usuario ADD VALUE IF NOT EXISTS 'master';

DO $$ BEGIN
    CREATE TYPE tipo_pedido AS ENUM ('salão', 'retirada', 'delivery');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE status_pedido AS ENUM ('pendente', 'em_preparacao', 'pronto', 'a_caminho', 'entregue', 'cancelado');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE forma_pagamento AS ENUM ('dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'mensalista');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. TABELA DE USUÁRIOS & FUNCIONÁRIOS (COM USUÁRIO MASTER INICIAL)
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    telefone VARCHAR(25) NOT NULL,
    cargo VARCHAR(50) NOT NULL DEFAULT 'atendente',
    status VARCHAR(20) NOT NULL DEFAULT 'ativo',
    senha VARCHAR(100) NOT NULL DEFAULT 'DNDIGQOL',
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SEED DO USUÁRIO MASTER INICIAL (master@kaipira.com / DNDIGQOL / CARGO: master)
INSERT INTO usuarios (nome, email, telefone, cargo, status, senha)
VALUES (
    'ADMINISTRADOR MASTER GERAL',
    'master@kaipira.com',
    '(19) 9-9999-9999',
    'master',
    'ativo',
    'DNDIGQOL'
)
ON CONFLICT (email) DO UPDATE 
SET cargo = 'master',
    senha = 'DNDIGQOL',
    status = 'ativo',
    atualizado_em = NOW();

ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso publico usuarios" ON usuarios;
CREATE POLICY "Acesso publico usuarios" ON usuarios FOR ALL USING (true) WITH CHECK (true);

-- 3. CLIENTES & MENSALISTAS (PIRACICABA)
CREATE TABLE IF NOT EXISTS clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(100) NOT NULL,
    telefone VARCHAR(20) UNIQUE NOT NULL,
    cep VARCHAR(10) NOT NULL,
    endereco VARCHAR(200) NOT NULL,
    numero VARCHAR(20) NOT NULL,
    bairro VARCHAR(100) NOT NULL,
    complemento VARCHAR(100),
    eh_mensalista BOOLEAN DEFAULT FALSE,
    saldo_devedor DECIMAL(10,2) DEFAULT 0.00,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. CATEGORIAS & PRODUTOS (COM URL_IMAGEM PARA SUPABASE STORAGE)
CREATE TABLE IF NOT EXISTS categorias (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(50) NOT NULL,
    ordem INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS produtos (
    id SERIAL PRIMARY KEY,
    categoria_id INT REFERENCES categorias(id),
    nome VARCHAR(100) NOT NULL,
    descricao TEXT,
    preco_salao DECIMAL(10,2) NOT NULL,
    preco_delivery DECIMAL(10,2),
    url_imagem TEXT,
    dia_semana INT[],
    pausado BOOLEAN DEFAULT FALSE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS opcionais (
    id SERIAL PRIMARY KEY,
    produto_id INT REFERENCES produtos(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    preco_adicional DECIMAL(10,2) DEFAULT 0.00
);

-- 5. ESTOQUE BÁSICO
CREATE TABLE IF NOT EXISTS estoque (
    id SERIAL PRIMARY KEY,
    item_nome VARCHAR(100) NOT NULL,
    quantidade_atual DECIMAL(10,2) NOT NULL DEFAULT 0,
    unidade_medida VARCHAR(20) DEFAULT 'un',
    estoque_minimo DECIMAL(10,2) DEFAULT 5.00,
    fornecedor_info TEXT,
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. MESAS & RESERVAS (20 MESAS)
CREATE TABLE IF NOT EXISTS mesas (
    id SERIAL PRIMARY KEY,
    numero INT UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'livre'
);

CREATE TABLE IF NOT EXISTS reservas (
    id SERIAL PRIMARY KEY,
    cliente_nome VARCHAR(100) NOT NULL,
    telefone VARCHAR(20) NOT NULL,
    mesa_id INT REFERENCES mesas(id),
    data_hora TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) DEFAULT 'confirmada'
);

-- 7. PEDIDOS & ITENS (COM CONFERÊNCIA DE DELIVERY PELO CAIXA)
CREATE TABLE IF NOT EXISTS pedidos (
    id SERIAL PRIMARY KEY,
    codigo_senha SERIAL,
    tipo tipo_pedido NOT NULL,
    status status_pedido DEFAULT 'pendente',
    cliente_id UUID REFERENCES clientes(id),
    mesa_id INT REFERENCES mesas(id),
    precisa_troco BOOLEAN DEFAULT FALSE,
    troco_para DECIMAL(10,2),
    motoboy_tipo VARCHAR(20),
    entregador_nome VARCHAR(150),
    conferencia_entrega VARCHAR(20) DEFAULT NULL,
    conferido_por VARCHAR(150) DEFAULT NULL,
    conferido_em TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    valor_total DECIMAL(10,2) DEFAULT 0.00,
    taxa_entrega DECIMAL(10,2) DEFAULT 0.00,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS conferencia_entrega VARCHAR(20) DEFAULT NULL;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS conferido_por VARCHAR(150) DEFAULT NULL;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS conferido_em TIMESTAMP WITH TIME ZONE DEFAULT NULL;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS entregador_nome VARCHAR(150) DEFAULT NULL;

CREATE TABLE IF NOT EXISTS itens_pedido (
    id SERIAL PRIMARY KEY,
    pedido_id INT REFERENCES pedidos(id) ON DELETE CASCADE,
    produto_id INT REFERENCES produtos(id),
    quantidade INT NOT NULL DEFAULT 1,
    observacao TEXT,
    preco_unitario DECIMAL(10,2) NOT NULL,
    opcionais_selecionados JSONB
);

-- 8. CAIXA & PAGAMENTOS
CREATE TABLE IF NOT EXISTS pagamentos (
    id SERIAL PRIMARY KEY,
    pedido_id INT REFERENCES pedidos(id) ON DELETE CASCADE,
    forma forma_pagamento NOT NULL,
    valor DECIMAL(10,2) NOT NULL,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS caixa_diario (
    id SERIAL PRIMARY KEY,
    data_caixa DATE UNIQUE DEFAULT CURRENT_DATE,
    valor_abertura DECIMAL(10,2) DEFAULT 0.00,
    valor_fechamento DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'aberto',
    observacoes TEXT,
    aberto_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fechado_em TIMESTAMP WITH TIME ZONE
);

-- 9. CONFIGURAÇÕES GERAIS DO RESTAURANTE (100% NUVEM SUPABASE)
CREATE TABLE IF NOT EXISTS configuracoes (
    id INT PRIMARY KEY DEFAULT 1,
    nome_restaurante VARCHAR(100),
    email VARCHAR(100),
    telefone VARCHAR(30),
    cep VARCHAR(10),
    endereco VARCHAR(200),
    numero VARCHAR(20),
    bairro VARCHAR(100),
    cidade VARCHAR(100) DEFAULT 'PIRACICABA',
    uf VARCHAR(2) DEFAULT 'SP',
    horario_funcionamento VARCHAR(150),
    posicao_menu VARCHAR(20) DEFAULT 'direita',
    padrao_cor VARCHAR(20) DEFAULT 'ambar',
    supabase_url TEXT,
    supabase_anon_key TEXT,
    banco_status VARCHAR(30) DEFAULT 'conectado',
    dados JSONB,
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. TABELA DO CARDÁPIO DIÁRIO DO RESTAURANTE (MONTAGEM DO DIA)
CREATE TABLE IF NOT EXISTS cardapio_diario (
    id SERIAL PRIMARY KEY,
    data DATE NOT NULL DEFAULT CURRENT_DATE,
    produto_id INT NOT NULL,
    canal VARCHAR(30) NOT NULL,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uk_cardapio_data_produto_canal UNIQUE (data, produto_id, canal)
);

ALTER TABLE cardapio_diario ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso publico cardapio_diario" ON cardapio_diario;
CREATE POLICY "Acesso publico cardapio_diario" ON cardapio_diario FOR ALL USING (true) WITH CHECK (true);

-- 11. BUCKET DE STORAGE PARA FOTOS DE PRODUTOS ('produtos')
INSERT INTO storage.buckets (id, name, public)
VALUES ('produtos', 'produtos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public Access produtos" ON storage.objects;
CREATE POLICY "Public Access produtos" ON storage.objects FOR SELECT USING (bucket_id = 'produtos');

DROP POLICY IF EXISTS "Public Upload produtos" ON storage.objects;
CREATE POLICY "Public Upload produtos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'produtos');

DROP POLICY IF EXISTS "Public Update produtos" ON storage.objects;
CREATE POLICY "Public Update produtos" ON storage.objects FOR UPDATE USING (bucket_id = 'produtos');

-- 12. ATIVAÇÃO DO SUPABASE REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE configuracoes;
ALTER PUBLICATION supabase_realtime ADD TABLE usuarios;
ALTER PUBLICATION supabase_realtime ADD TABLE cardapio_diario;
ALTER PUBLICATION supabase_realtime ADD TABLE pedidos;
ALTER PUBLICATION supabase_realtime ADD TABLE mesas;
ALTER PUBLICATION supabase_realtime ADD TABLE estoque;
ALTER PUBLICATION supabase_realtime ADD TABLE caixa_diario;
`;

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
  const [copiedSql, setCopiedSql] = useState(false);

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

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
        if (onOpenSupabaseModal) {
          onOpenSupabaseModal();
        } else {
          document.getElementById('supabase-schema-section')?.scrollIntoView({ behavior: 'smooth' });
        }
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
                  onClick={() => {
                    const el = document.getElementById('supabase-schema-section');
                    el?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-750 text-emerald-400 border border-neutral-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
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

          {/* PADRÕES DE CORES CONFIGURÁVEIS (11 PALETAS) */}
          <div className="bg-neutral-850 p-5 rounded-2xl border border-neutral-800 shadow-xs flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-purple-400" />
                <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">
                  Padrões de Cores do Restaurante (11 Paletas)
                </h3>
              </div>
              <span className="text-[10px] font-mono text-purple-400 font-bold px-2 py-0.5 rounded bg-purple-950/60 border border-purple-800">
                11 TEMAS (INCLUI WINDOWS SEGOE UI)
              </span>
            </div>

            <p className="text-xs text-neutral-400">
              Clique em qualquer paleta para <strong>aplicar instantaneamente</strong> a combinação de cores, contraste de fundo e tipografia em todo o sistema e <strong>salvar a alteração na nuvem</strong>:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(Object.keys(THEMES) as PadraoCor[]).map((themeKey) => {
                const theme = THEMES[themeKey];
                const isSelected = formData.padraoCor === themeKey;

                return (
                  <button
                    key={themeKey}
                    type="button"
                    onClick={() => {
                      const updated = { ...formData, padraoCor: themeKey };
                      setFormData(updated);
                      onSaveConfiguracoes(updated);
                      setSavedSuccess(true);
                      setTimeout(() => setSavedSuccess(false), 3000);
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-3 cursor-pointer ${
                      isSelected
                        ? 'border-amber-500 bg-neutral-900 ring-2 ring-amber-500/80 shadow-lg scale-[1.01]'
                        : 'border-neutral-800 bg-neutral-900/60 hover:border-neutral-700 hover:bg-neutral-850/80'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        {/* Color Swatch Dots */}
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-5 h-5 rounded-full shadow-md shrink-0 border border-white/20"
                            style={{ backgroundColor: theme.dotColor }}
                            title={`Cor Primária: ${theme.dotColor}`}
                          />
                          <span
                            className="w-3.5 h-3.5 rounded-full shadow-xs shrink-0 border border-white/10"
                            style={{ backgroundColor: theme.accentColor }}
                            title={`Cor de Destaque: ${theme.accentColor}`}
                          />
                          <span className="text-[10px] font-mono font-bold uppercase text-neutral-400 ml-1">
                            {theme.id === 'ambar' ? '★ KAIPIRA PADRÃO' : themeKey.toUpperCase()}
                          </span>
                        </div>

                        {isSelected ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1">
                            <Check className="w-3 h-3 text-emerald-400" />
                            Ativo
                          </span>
                        ) : (
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase shadow-xs"
                            style={{ backgroundColor: theme.dotColor }}
                          >
                            Clique p/ Aplicar
                          </span>
                        )}
                      </div>

                      <span className="text-xs font-black text-white uppercase block leading-tight">
                        {theme.name}
                      </span>
                      <span className="text-[11px] text-neutral-400 block mt-1">
                        {theme.desc}
                      </span>
                    </div>

                    {/* Preview Strip of background and typography */}
                    <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between text-[10px] text-neutral-400">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono">
                          {theme.fontLabel}
                        </span>
                        <span className={`text-[11px] font-bold ${theme.fontStyle} text-neutral-200`}>
                          AaBb 123
                        </span>
                      </div>
                      <span
                        className="font-bold uppercase tracking-wider"
                        style={{ color: theme.dotColor }}
                      >
                        ● Tom {themeKey}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* FULL WIDTH DEDICATED SECTION: ESTRUTURA DO BANCO (SUPABASE SQL SCHEMA) */}
        <div
          id="supabase-schema-section"
          className="lg:col-span-12 bg-neutral-850 p-6 rounded-2xl border border-neutral-800 shadow-md flex flex-col gap-4"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-neutral-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-950 border border-emerald-800 rounded-xl text-emerald-400">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-white uppercase tracking-tight flex items-center gap-2">
                  <span>Estrutura do Banco (Supabase SQL Schema)</span>
                  <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                    PostgreSQL DDL
                  </span>
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Script DDL de tabelas, enums, bucket público de fotos ('produtos') e policies de Realtime para o SQL Editor do Supabase
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopySql}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer uppercase ${
                copiedSql
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-700 hover:bg-emerald-600 text-white hover:scale-105 active:scale-95'
              }`}
            >
              {copiedSql ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedSql ? 'Código SQL Copiado!' : 'Copiar Código SQL'}</span>
            </button>
          </div>

          {/* Formatted Code Block */}
          <div className="relative rounded-xl border border-neutral-800 bg-neutral-950 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-neutral-900 border-b border-neutral-800 text-xs text-neutral-400 font-mono">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-emerald-400" />
                <span>schema_restaurante_kaipira.sql</span>
              </div>
              <span className="text-[11px] text-neutral-500 hidden sm:inline">12 Módulos · 100% Compatível com Supabase Realtime & Storage</span>
            </div>
            <pre className="p-4 text-[11px] font-mono text-emerald-300 max-h-[380px] overflow-y-auto overflow-x-auto leading-relaxed select-all">
              {SUPABASE_SCHEMA_SQL}
            </pre>
          </div>
        </div>
      </form>
    </div>
  );
};
