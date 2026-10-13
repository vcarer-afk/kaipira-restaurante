import React, { useState } from 'react';
import { Database, Copy, Check, X, ShieldCheck, Zap } from 'lucide-react';

interface SupabaseInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabaseInfoModal: React.FC<SupabaseInfoModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const sqlScript = `-- =========================================================================
-- SUPABASE POSTGRESQL SCHEMA COMPLETO - RESTAURANTE KAIPIRA (PIRACICABA - SP)
-- Execute no SQL Editor do seu projeto Supabase (https://app.supabase.com)
-- =========================================================================

-- 1. TIPOS ENUM
DO $$ BEGIN
    CREATE TYPE tipo_usuario AS ENUM ('admin', 'atendente', 'cozinha', 'garcom', 'entregador');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE tipo_pedido AS ENUM ('salão', 'retirada', 'delivery');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE status_pedido AS ENUM ('pendente', 'em_preparacao', 'pronto', 'a_caminho', 'entregue', 'cancelado');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE forma_pagamento AS ENUM ('dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'mensalista');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. USUÁRIOS & PERFIS
CREATE TABLE IF NOT EXISTS perfis (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    cargo tipo_usuario DEFAULT 'atendente',
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

-- 4. CATEGORIAS & PRODUTOS
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
    dia_semana INT[], -- Array [1..6] para dias de exibição (1=Seg, 6=Sáb)
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

-- 7. PEDIDOS & ITENS
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
    valor_total DECIMAL(10,2) DEFAULT 0.00,
    taxa_entrega DECIMAL(10,2) DEFAULT 0.00,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

-- 9. ATIVAÇÃO DO SUPABASE REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE pedidos;
ALTER PUBLICATION supabase_realtime ADD TABLE mesas;
ALTER PUBLICATION supabase_realtime ADD TABLE estoque;
ALTER PUBLICATION supabase_realtime ADD TABLE caixa_diario;
`;

  const handleCopy = () => {
    navigator.clipboard.writeText(sqlScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh]">
        <div className="flex items-start justify-between border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-950 border border-emerald-800 rounded-lg text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white uppercase tracking-tight">
                Esquema Supabase PostgreSQL & Sincronização em Nuvem
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Restaurante Kaipira · Piracicaba (SP) · 100% Armazenado na Nuvem
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feature badges */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          <div className="p-2.5 bg-neutral-850 rounded-lg border border-neutral-800 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-neutral-300">Sem dados locais (100% Cloud)</span>
          </div>
          <div className="p-2.5 bg-neutral-850 rounded-lg border border-neutral-800 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-neutral-300">Realtime habilitado</span>
          </div>
          <div className="p-2.5 bg-neutral-850 rounded-lg border border-neutral-800 flex items-center gap-2">
            <Database className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="text-neutral-300">Compatível com Supabase & Postgres</span>
          </div>
        </div>

        {/* SQL Viewer */}
        <div className="flex-1 overflow-hidden flex flex-col bg-neutral-950 rounded-xl border border-neutral-800 p-3">
          <div className="flex justify-between items-center text-xs text-neutral-400 pb-2 border-b border-neutral-800">
            <span className="font-mono">schema_restaurante_kaipira.sql</span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-xs transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copiado para Área de Transferência!' : 'Copiar SQL'}
            </button>
          </div>
          <pre className="text-[11px] font-mono text-neutral-300 overflow-y-auto p-2 leading-relaxed selection:bg-amber-600">
            {sqlScript}
          </pre>
        </div>

        {/* Modal footer */}
        <div className="flex items-center justify-between text-xs text-neutral-400 pt-2 border-t border-neutral-800">
          <span>Cole este script no SQL Editor do painel do Supabase.</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg font-bold"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
