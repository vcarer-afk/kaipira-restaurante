import React, { useState, useEffect } from 'react';
import { Pedido } from '../types';
import { playAlertChime } from '../utils/formatters';
import { Volume2, Maximize, Minimize, BellRing, Sparkles } from 'lucide-react';

interface LedPanelProps {
  pedidos: Pedido[];
}

export const LedPanel: React.FC<LedPanelProps> = ({ pedidos }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lastCalled, setLastCalled] = useState<Pedido | null>(null);

  // Ready orders
  const readyOrders = pedidos
    .filter((p) => p.status === 'pronto')
    .sort((a, b) => new Date(b.atualizado_em).getTime() - new Date(a.atualizado_em).getTime());

  // Preparing orders
  const preparingOrders = pedidos
    .filter((p) => p.status === 'em_preparacao')
    .sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime());

  // Check if a new order becomes ready
  useEffect(() => {
    if (readyOrders.length > 0) {
      const topOrder = readyOrders[0];
      if (!lastCalled || lastCalled.id !== topOrder.id) {
        setLastCalled(topOrder);
        playAlertChime('ready');
      }
    }
  }, [readyOrders, lastCalled]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleManualChime = (pedido: Pedido) => {
    setLastCalled(pedido);
    playAlertChime('ready');
  };

  const activeTicket = lastCalled || (readyOrders.length > 0 ? readyOrders[0] : null);

  return (
    <div className="flex flex-col gap-4">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between bg-neutral-850 p-4 rounded-xl border border-neutral-800">
        <div>
          <h2 className="text-sm font-extrabold text-white uppercase flex items-center gap-2">
            <BellRing className="w-5 h-5 text-emerald-400" />
            <span>Painel de LED & Chamada de Senhas (Salão e Retirada)</span>
          </h2>
          <p className="text-xs text-neutral-400">
            Projetado para telas grandes de TV no balcão de retirada e salão do Kaipira
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => playAlertChime('ready')}
            className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors border border-neutral-700"
          >
            <Volume2 className="w-4 h-4 text-amber-400" />
            Testar Alerta Sonoro
          </button>

          <button
            onClick={toggleFullscreen}
            className="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            {isFullscreen ? 'Sair da Tela Cheia' : 'Modo TV Tela Cheia'}
          </button>
        </div>
      </div>

      {/* Main Digital LED Display Frame */}
      <div className="bg-black rounded-2xl border-4 border-neutral-800 p-6 md:p-8 flex flex-col gap-8 shadow-2xl relative overflow-hidden">
        {/* Subtle LED Matrix scanline effect */}
        <div className="absolute inset-0 bg-radial from-emerald-950/20 via-transparent to-black pointer-events-none" />

        {/* TOP: Giant Banner for Latest Ready Ticket */}
        <div className="bg-neutral-900/90 rounded-2xl border-2 border-emerald-500/80 p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl relative">
          <div className="text-center md:text-left flex-1">
            <div className="flex items-center justify-center md:justify-start gap-2 text-xs font-black uppercase text-emerald-400 tracking-widest mb-1">
              <Sparkles className="w-4 h-4 animate-pulse text-emerald-400" />
              <span>PEDIDO PRONTO - FAVOR RETIRAR NO BALCÃO</span>
            </div>

            {activeTicket ? (
              <div>
                <div className="text-6xl sm:text-8xl md:text-9xl font-black text-emerald-400 font-mono tracking-tight tabular-nums py-2 drop-shadow-[0_0_25px_rgba(16,185,129,0.45)]">
                  SENHA #{activeTicket.codigo_senha}
                </div>
                <div className="text-lg sm:text-xl font-extrabold text-white uppercase tracking-wide mt-2">
                  {activeTicket.tipo === 'salão'
                    ? `MESA ${activeTicket.mesa_id || 'SALÃO'}`
                    : activeTicket.tipo.toUpperCase()}{' '}
                  {activeTicket.cliente?.nome ? `— ${activeTicket.cliente.nome}` : ''}
                </div>
              </div>
            ) : (
              <div className="text-3xl sm:text-5xl font-black text-neutral-600 font-mono py-6">
                AGUARDANDO PRÓXIMA SENHA...
              </div>
            )}
          </div>

          {activeTicket && (
            <button
              onClick={() => handleManualChime(activeTicket)}
              className="px-6 py-4 bg-emerald-600 hover:bg-emerald-500 text-neutral-950 font-black rounded-xl text-sm flex items-center gap-2 uppercase shadow-lg transition-transform hover:scale-105 active:scale-95"
            >
              <Volume2 className="w-5 h-5" />
              Chamar Novamente
            </button>
          )}
        </div>

        {/* BOTTOM TWO COLUMNS: Ready Tickets List vs Preparing Tickets List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
          {/* Column 1: Outras Senhas Prontas */}
          <div className="bg-neutral-900/70 rounded-xl border border-emerald-900/60 p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-emerald-900/60 pb-3">
              <h3 className="text-sm font-black text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                <span>SENHAS PRONTAS PARA RETIRADA ({readyOrders.length})</span>
              </h3>
            </div>

            {readyOrders.length === 0 ? (
              <div className="py-8 text-center text-xs text-neutral-600 uppercase font-mono">
                NENHUMA SENHA PRONTA NO MOMENTO
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-72 overflow-y-auto">
                {readyOrders.map((ord) => (
                  <button
                    key={ord.id}
                    onClick={() => handleManualChime(ord)}
                    className="p-3 bg-neutral-950 border border-emerald-600/50 hover:border-emerald-400 rounded-xl flex flex-col items-center justify-center transition-all group"
                  >
                    <span className="text-3xl font-black text-emerald-400 font-mono tabular-nums group-hover:scale-110 transition-transform">
                      #{ord.codigo_senha}
                    </span>
                    <span className="text-[10px] text-neutral-400 uppercase font-bold mt-1">
                      {ord.tipo === 'salão' ? `MESA ${ord.mesa_id}` : ord.tipo}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Column 2: Senhas em Preparação */}
          <div className="bg-neutral-900/70 rounded-xl border border-amber-900/60 p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-amber-900/60 pb-3">
              <h3 className="text-sm font-black text-amber-400 uppercase tracking-wider">
                EM PREPARAÇÃO NO FOGÃO A LENHA ({preparingOrders.length})
              </h3>
            </div>

            {preparingOrders.length === 0 ? (
              <div className="py-8 text-center text-xs text-neutral-600 uppercase font-mono">
                NENHUM PEDIDO EM PREPARO
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-72 overflow-y-auto">
                {preparingOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="p-3 bg-neutral-950 border border-amber-700/40 rounded-xl flex flex-col items-center justify-center"
                  >
                    <span className="text-2xl font-black text-amber-400/90 font-mono tabular-nums">
                      #{ord.codigo_senha}
                    </span>
                    <span className="text-[10px] text-neutral-500 uppercase font-bold mt-1">
                      {ord.tipo === 'salão' ? `MESA ${ord.mesa_id}` : ord.tipo}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer info strip */}
        <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-500 border-t border-neutral-800 pt-4 font-mono">
          <span>RESTAURANTE KAIPIRA · PIRACICABA - SP</span>
          <span>SISTEMA DE GESTÃO E DELIVERY PRÓPRIO</span>
        </div>
      </div>
    </div>
  );
};
