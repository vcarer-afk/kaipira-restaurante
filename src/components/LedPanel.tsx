import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Pedido, ConfiguracoesSistema } from '../types';
import { Volume2, VolumeX, Maximize, Minimize, Bell, Sliders, ArrowLeft } from 'lucide-react';

interface LedPanelProps {
  pedidos: Pedido[];
  configuracoes?: ConfiguracoesSistema;
  onOpenSettings?: () => void;
  onBack?: () => void;
}

export const LedPanel: React.FC<LedPanelProps> = ({
  pedidos,
  configuracoes,
  onOpenSettings,
  onBack,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lastCalledOrder, setLastCalledOrder] = useState<Pedido | null>(null);
  const [isBlinking, setIsBlinking] = useState(false);
  const [isLedLit, setIsLedLit] = useState(true);
  const [audioAtivado, setAudioAtivado] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const blinkTimerRef = useRef<NodeJS.Timeout | null>(null);
  const blinkStepRef = useRef<number>(0);
  const speechTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastProcessedIdRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Settings
  const ledCor = configuracoes?.ledCor || 'vermelho';
  const ledFonte = configuracoes?.ledFonte || 'mono';
  const ledCampainha = configuracoes?.ledCampainha || 'ding_dong';
  const ledVoz = configuracoes?.ledVoz || 'padrao';

  // Color Styles Configuration
  const COLOR_STYLES: Record<string, { color: string; glow: string; unlit: string }> = {
    vermelho: {
      color: '#ff2020',
      glow: '0 0 50px rgba(255,32,32,0.9), 0 0 90px rgba(255,0,0,0.6)',
      unlit: '#3b0808',
    },
    verde: {
      color: '#22ff44',
      glow: '0 0 50px rgba(34,255,68,0.9), 0 0 90px rgba(0,255,50,0.6)',
      unlit: '#07360e',
    },
    ambar: {
      color: '#ff9900',
      glow: '0 0 50px rgba(255,153,0,0.9), 0 0 90px rgba(255,130,0,0.6)',
      unlit: '#3b2200',
    },
    ciano: {
      color: '#00eeff',
      glow: '0 0 50px rgba(0,238,255,0.9), 0 0 90px rgba(0,200,255,0.6)',
      unlit: '#022933',
    },
    branco: {
      color: '#ffffff',
      glow: '0 0 50px rgba(255,255,255,0.9), 0 0 90px rgba(200,220,255,0.6)',
      unlit: '#262626',
    },
  };

  const activeColor = COLOR_STYLES[ledCor] || COLOR_STYLES.vermelho;

  // Font Styles Configuration
  const FONT_CLASSES: Record<string, string> = {
    mono: 'font-mono tracking-widest',
    jetbrains: 'font-mono font-black tracking-normal',
    grotesca: 'font-sans font-black tracking-tighter',
    orbitron: 'font-mono font-black uppercase tracking-wider',
    classico: 'font-sans font-black uppercase tracking-tight',
  };

  const activeFontClass = FONT_CLASSES[ledFonte] || FONT_CLASSES.mono;

  // Ready orders sorted by most recently updated
  const readyOrders = pedidos
    .filter((p) => p.status === 'pronto')
    .sort((a, b) => new Date(b.atualizado_em).getTime() - new Date(a.atualizado_em).getTime());

  // Helper to retrieve/resume AudioContext
  const getAudioContext = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          audioCtxRef.current = new AudioCtx();
        }
      }
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
      return audioCtxRef.current;
    } catch {
      return null;
    }
  }, []);

  // Unlock browser audio permissions on user gesture
  const ativarAudio = useCallback(() => {
    try {
      const ctx = getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.resume?.();
      }
      setAudioAtivado(true);
    } catch (err) {
      console.warn('Erro ao ativar áudio:', err);
    }
  }, [getAudioContext]);

  // Play synthesized Chimes (5 types)
  const tocarCampainha = useCallback(
    (tipoCampainha: string) => {
      try {
        const ctx = getAudioContext();
        if (!ctx) return;
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
        const now = ctx.currentTime;

        const playTone = (freq: number, start: number, duration: number, gainPeak = 0.85, type: OscillatorType = 'sine') => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = type;
          osc.frequency.setValueAtTime(freq, start);
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(gainPeak, start + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(start);
          osc.stop(start + duration);
        };

        if (tipoCampainha === 'carrilhao') {
          // Carrilhão Triplo: 523Hz -> 659Hz -> 784Hz
          playTone(523.25, now, 0.7, 0.75);
          playTone(659.25, now + 0.22, 0.8, 0.85);
          playTone(783.99, now + 0.44, 1.2, 0.95);
        } else if (tipoCampainha === 'bip_duplo') {
          // Bip Eletrônico Duplo: 880Hz rápido
          playTone(880, now, 0.12, 0.8, 'square');
          playTone(880, now + 0.16, 0.16, 0.8, 'square');
        } else if (tipoCampainha === 'marimba') {
          // Marimba Aconchegante: harmônicos orgânicos
          playTone(440, now, 0.6, 0.85, 'triangle');
          playTone(880, now, 0.4, 0.4, 'sine');
          playTone(554.37, now + 0.15, 0.7, 0.8, 'triangle');
        } else if (tipoCampainha === 'gongo') {
          // Gongo Profundo: ressonância senoidal grave 220Hz com fade longo
          playTone(220, now, 2.5, 0.95, 'sine');
          playTone(110, now, 2.8, 0.6, 'sine');
          playTone(440, now, 1.2, 0.35, 'triangle');
        } else {
          // ding_dong (padrão)
          playTone(659.25, now, 0.75, 0.85, 'sine'); // Ding (Mi5)
          playTone(523.25, now + 0.3, 1.4, 0.9, 'sine'); // Dong (Dó5)
        }
      } catch (err) {
        console.warn('AudioContext notice:', err);
      }
    },
    [getAudioContext]
  );

  // Blink sequence: exactly 4 times in 4 seconds (1s cycle: 0.5s lit, 0.5s off)
  const triggerBlinkSequence = useCallback(() => {
    if (blinkTimerRef.current) {
      clearInterval(blinkTimerRef.current);
      blinkTimerRef.current = null;
    }

    setIsBlinking(true);
    setIsLedLit(true);
    blinkStepRef.current = 0;

    blinkTimerRef.current = setInterval(() => {
      blinkStepRef.current += 1;
      const currentStep = blinkStepRef.current;

      if (currentStep >= 8) {
        if (blinkTimerRef.current) {
          clearInterval(blinkTimerRef.current);
          blinkTimerRef.current = null;
        }
        setIsBlinking(false);
        setIsLedLit(true);
      } else {
        setIsLedLit(currentStep % 2 === 0);
      }
    }, 500);
  }, []);

  // Web Speech API: tratamento assíncrono com variações de voz configuráveis
  const falarSenha = useCallback(
    (numero: number, variacaoVoz: string) => {
      if (!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();

      const texto = `Senha número ${numero}`;
      const utterance = new SpeechSynthesisUtterance(texto);
      utterance.lang = 'pt-BR';

      // Configurações de voz
      if (variacaoVoz === 'pausada') {
        utterance.rate = 0.85;
        utterance.pitch = 1.0;
      } else if (variacaoVoz === 'rapida') {
        utterance.rate = 1.1;
        utterance.pitch = 1.0;
      } else if (variacaoVoz === 'grave') {
        utterance.rate = 0.92;
        utterance.pitch = 0.8;
      } else if (variacaoVoz === 'aguda') {
        utterance.rate = 0.95;
        utterance.pitch = 1.25;
      } else {
        // padrao
        utterance.rate = 0.92;
        utterance.pitch = 1.0;
      }

      const carregarEFalar = () => {
        const vozes = window.speechSynthesis.getVoices();
        const vozPt = vozes.find((v) => v.lang.includes('pt-BR') || v.lang.includes('pt'));
        if (vozPt) utterance.voice = vozPt;
        window.speechSynthesis.speak(utterance);
      };

      if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.onvoiceschanged = carregarEFalar;
      } else {
        carregarEFalar();
      }
    },
    []
  );

  // Sincronização Exata:
  // 1. Toca campainha
  // 2. Aciona o efeito de piscar os dígitos vermelhos 4 vezes durante 4 segundos
  // 3. Após 800ms, dispara falarSenha(numero)
  const anunciarSenha = useCallback(
    (numero: number) => {
      tocarCampainha(ledCampainha);
      triggerBlinkSequence();

      if (speechTimeoutRef.current) {
        clearTimeout(speechTimeoutRef.current);
        speechTimeoutRef.current = null;
      }

      speechTimeoutRef.current = setTimeout(() => {
        falarSenha(numero, ledVoz);
      }, 800);
    },
    [tocarCampainha, ledCampainha, triggerBlinkSequence, falarSenha, ledVoz]
  );

  // Pre-load voices for SpeechSynthesis
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      const handleVoicesChanged = () => {
        window.speechSynthesis.getVoices();
      };
      window.speechSynthesis.onvoiceschanged = handleVoicesChanged;
      return () => {
        window.speechSynthesis.onvoiceschanged = null;
      };
    }
  }, []);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (blinkTimerRef.current) {
        clearInterval(blinkTimerRef.current);
      }
      if (speechTimeoutRef.current) {
        clearTimeout(speechTimeoutRef.current);
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Sync fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Helper to determine if an order has been concluded
  const isPedidoConcluido = (p: Pedido): boolean => {
    if (p.status === 'cancelado') return true;
    if (p.tipo === 'delivery') {
      return p.status === 'a_caminho' || p.status === 'entregue' || p.conferencia_entrega === 'conferido';
    }
    // Balcão e Mesas
    return p.status === 'entregue';
  };

  // Auto-trigger when a new order changes status to 'pronto' or auto-clear when concluded
  useEffect(() => {
    // 1. Se existe uma senha atualmente exibida, verifica se foi concluída
    if (lastCalledOrder) {
      const currentInDb = pedidos.find((p) => p.id === lastCalledOrder.id);
      const concluido = !currentInDb || isPedidoConcluido(currentInDb);

      if (concluido) {
        // Pedido foi entregue, despachado ou conferido:
        // Procura se há outro pedido esperando com status 'pronto'
        const proximosProntos = pedidos
          .filter((p) => p.status === 'pronto' && p.id !== lastCalledOrder.id)
          .sort((a, b) => new Date(b.atualizado_em).getTime() - new Date(a.atualizado_em).getTime());

        if (proximosProntos.length > 0) {
          const proximo = proximosProntos[0];
          lastProcessedIdRef.current = proximo.id;
          setLastCalledOrder(proximo);
          const numero = proximo.codigo_senha != null ? proximo.codigo_senha : 1;
          anunciarSenha(numero);
        } else {
          // Nenhum outro pedido pronto: limpa o painel e exibe os traços digitais '---'
          setLastCalledOrder(null);
          lastProcessedIdRef.current = null;
        }
        return;
      }
    }

    // 2. Se nenhuma senha está sendo exibida, ou chegou um novo pedido pronto da cozinha
    const pedidosProntos = pedidos
      .filter((p) => p.status === 'pronto')
      .sort((a, b) => new Date(b.atualizado_em).getTime() - new Date(a.atualizado_em).getTime());

    if (pedidosProntos.length > 0) {
      const maisRecente = pedidosProntos[0];
      if (!lastCalledOrder || (maisRecente.id !== lastCalledOrder.id && maisRecente.id !== lastProcessedIdRef.current)) {
        lastProcessedIdRef.current = maisRecente.id;
        setLastCalledOrder(maisRecente);
        const numero = maisRecente.codigo_senha != null ? maisRecente.codigo_senha : 1;
        anunciarSenha(numero);
      }
    }
  }, [pedidos, lastCalledOrder, anunciarSenha]);

  const toggleFullscreen = () => {
    const target = containerRef.current || document.documentElement;
    if (!document.fullscreenElement) {
      target.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const activeTicket = lastCalledOrder;

  const handleManualCall = () => {
    if (!audioAtivado) ativarAudio();
    const numero =
      activeTicket?.codigo_senha != null
        ? activeTicket.codigo_senha
        : readyOrders.length > 0 && readyOrders[0].codigo_senha != null
        ? readyOrders[0].codigo_senha
        : 1;
    anunciarSenha(numero);
  };

  const handleTestSound = () => {
    if (!audioAtivado) ativarAudio();
    const testNumber = activeTicket?.codigo_senha != null ? activeTicket.codigo_senha : 42;
    anunciarSenha(testNumber);
  };

  // Format 3 digits: e.g. "042" or "---"
  const formattedNumber =
    activeTicket?.codigo_senha != null
      ? String(activeTicket.codigo_senha).padStart(3, '0')
      : '---';

  const hasActiveTicket = activeTicket?.codigo_senha != null;

  return (
    <div
      ref={containerRef}
      onClick={() => {
        if (!audioAtivado) ativarAudio();
      }}
      className="bg-black w-screen h-screen fixed inset-0 overflow-hidden flex items-center justify-center select-none z-50"
    >
      {/* NÚMERO GIGANTE MINIMALISTA (100% livre de molduras e caixas) */}
      <div
        className={`text-[26vw] sm:text-[30vw] font-black leading-none text-center select-none transition-all duration-100 ${activeFontClass} ${
          isBlinking && !isLedLit ? 'opacity-10 scale-[0.99]' : 'opacity-100 scale-100'
        }`}
        style={{
          color: hasActiveTicket ? activeColor.color : activeColor.unlit,
          textShadow:
            hasActiveTicket && (!isBlinking || isLedLit)
              ? activeColor.glow
              : 'none',
        }}
      >
        {formattedNumber}
      </div>

      {/* CONTROLES OCULTOS NA BASE (revelam-se suavemente ao aproximar o mouse) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-auto">
        <div className="flex items-center gap-2 p-2 bg-neutral-900/90 backdrop-blur-md rounded-2xl border border-neutral-800 shadow-2xl">
          {!audioAtivado ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                ativarAudio();
                handleTestSound();
              }}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-lg animate-pulse"
              title="Ativar Áudio e Voz da TV"
            >
              <VolumeX className="w-4 h-4" />
              <span>Ativar Áudio TV</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleTestSound();
              }}
              className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold text-xs uppercase rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Testar Campainha e Voz Sintetizada"
            >
              <Volume2 className="w-4 h-4 text-emerald-400" />
              <span>Testar Som</span>
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleManualCall();
            }}
            className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold text-xs uppercase rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Repetir Chamada da Senha Atual"
          >
            <Bell className="w-4 h-4 text-red-500 animate-pulse" />
            <span>Chamar Novamente</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFullscreen();
            }}
            className="p-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl transition-colors cursor-pointer"
            title={isFullscreen ? 'Sair da Tela Cheia' : 'Tela Cheia (Modo TV)'}
          >
            {isFullscreen ? <Minimize className="w-4 h-4 text-amber-400" /> : <Maximize className="w-4 h-4 text-amber-400" />}
          </button>

          {onOpenSettings && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenSettings();
              }}
              className="p-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl transition-colors cursor-pointer"
              title="Configurar Cor, Fonte, Som e Voz do Painel"
            >
              <Sliders className="w-4 h-4 text-cyan-400" />
            </button>
          )}

          {onBack && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onBack();
              }}
              className="p-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl transition-colors cursor-pointer"
              title="Voltar ao Sistema"
            >
              <ArrowLeft className="w-4 h-4 text-neutral-400" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
