import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Pedido } from '../types';
import { Volume2, VolumeX, Maximize, Minimize, Bell } from 'lucide-react';

interface LedPanelProps {
  pedidos: Pedido[];
}

export const LedPanel: React.FC<LedPanelProps> = ({ pedidos }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lastCalledOrder, setLastCalledOrder] = useState<Pedido | null>(null);
  const [isBlinking, setIsBlinking] = useState(false);
  const [isLedLit, setIsLedLit] = useState(true);
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const blinkTimerRef = useRef<NodeJS.Timeout | null>(null);
  const blinkStepRef = useRef<number>(0);
  const speechTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastProcessedIdRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

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
  const unlockAudio = useCallback(() => {
    setIsAudioUnlocked(true);
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.resume?.();
    }
  }, [getAudioContext]);

  // Authentic Web Audio API "Ding-Dong" chime
  const playDingDong = useCallback(() => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const now = ctx.currentTime;

      // Tone 1: "Ding" (Mi5 / 659.25 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.85, now + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.75);

      // Tone 2: "Dong" (Dó5 / 523.25 Hz) playing 0.3s later with natural decay
      const startTime2 = now + 0.3;
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(523.25, startTime2);
      gain2.gain.setValueAtTime(0, startTime2);
      gain2.gain.linearRampToValueAtTime(0.9, startTime2 + 0.03);
      gain2.gain.exponentialRampToValueAtTime(0.001, startTime2 + 1.4);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(startTime2);
      osc2.stop(startTime2 + 1.4);
    } catch (err) {
      console.warn('AudioContext playback notice:', err);
    }
  }, [getAudioContext]);

  // Blink sequence: exactly 4 times in 4 seconds (1s cycle: 0.5s lit, 0.5s off)
  const triggerBlinkSequence = useCallback(() => {
    if (blinkTimerRef.current) {
      clearInterval(blinkTimerRef.current);
      blinkTimerRef.current = null;
    }

    setIsBlinking(true);
    setIsLedLit(true);
    blinkStepRef.current = 0;

    // 8 steps of 500ms = 4000ms (4 seconds).
    // Steps 0, 2, 4, 6: lit (0.5s)
    // Steps 1, 3, 5, 7: unlit (0.5s)
    // Step 8: finish blinking, stay permanently lit.
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

  // Main Announce Function: Ding-Dong + Blink + Web Speech API (900ms delay)
  const anunciarSenha = useCallback(
    (numero: number) => {
      // 1. Toca campainha bitonal ("Ding-Dong")
      playDingDong();

      // 2. Dispara o efeito de piscar os dígitos vermelhos (4x em 4s)
      triggerBlinkSequence();

      // 3. Cancela agendamentos anteriores de fala
      if (speechTimeoutRef.current) {
        clearTimeout(speechTimeoutRef.current);
        speechTimeoutRef.current = null;
      }

      // Aguarda 900ms (tempo do ding-dong soar) e aciona a síntese de voz nativa
      speechTimeoutRef.current = setTimeout(() => {
        try {
          if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel(); // Cancela chamadas anteriores pendentes
            const texto = `Senha número ${numero}`;
            const utterance = new SpeechSynthesisUtterance(texto);
            utterance.lang = 'pt-BR';
            utterance.rate = 0.95; // Cadência clara e natural para salão
            utterance.pitch = 1.0;

            // Seleciona voz em português se disponível no navegador
            const voices = window.speechSynthesis.getVoices();
            const ptVoice = voices.find((v) => v.lang.includes('pt-BR') || v.lang.includes('pt'));
            if (ptVoice) utterance.voice = ptVoice;

            window.speechSynthesis.speak(utterance);
          }
        } catch (err) {
          console.warn('SpeechSynthesis error:', err);
        }
      }, 900);
    },
    [playDingDong, triggerBlinkSequence]
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

  // Clean up timers & speech on unmount
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

  // Sync fullscreen state with document event
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Auto-trigger when a new order changes status to 'pronto'
  useEffect(() => {
    if (readyOrders.length > 0) {
      const topReady = readyOrders[0];
      if (lastProcessedIdRef.current !== topReady.id) {
        lastProcessedIdRef.current = topReady.id;
        setLastCalledOrder(topReady);
        const numero = topReady.codigo_senha != null ? topReady.codigo_senha : 1;
        anunciarSenha(numero);
      }
    }
  }, [readyOrders, anunciarSenha]);

  const toggleFullscreen = () => {
    const target = containerRef.current || document.documentElement;
    if (!document.fullscreenElement) {
      target.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const activeTicket = lastCalledOrder || (readyOrders.length > 0 ? readyOrders[0] : null);

  // Trigger manual recall
  const handleManualCall = () => {
    unlockAudio();
    const numero = activeTicket?.codigo_senha != null ? activeTicket.codigo_senha : 1;
    anunciarSenha(numero);
  };

  // Trigger test sound & voice announcement
  const handleTestSound = () => {
    unlockAudio();
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
        if (!isAudioUnlocked) unlockAudio();
      }}
      className={`bg-black text-white flex flex-col items-center justify-center relative select-none overflow-hidden transition-all duration-300 ${
        isFullscreen
          ? 'fixed inset-0 z-50 w-screen h-screen min-h-screen p-4 sm:p-8'
          : 'w-full min-h-[calc(100vh-140px)] rounded-3xl p-4 sm:p-8 border border-neutral-900 shadow-2xl'
      }`}
    >
      {/* Subtle ambient red LED wall reflection */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-300"
        style={{
          background:
            hasActiveTicket && (!isBlinking || isLedLit)
              ? 'radial-gradient(circle at 50% 50%, rgba(255, 30, 30, 0.12) 0%, rgba(0, 0, 0, 0.95) 75%)'
              : 'radial-gradient(circle at 50% 50%, rgba(50, 10, 10, 0.05) 0%, rgba(0, 0, 0, 1) 85%)',
        }}
      />

      {/* Discret Top-Right Control Bar (Modo TV / Fullscreen) */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-30 flex items-center gap-2 opacity-40 hover:opacity-100 transition-opacity duration-200">
        {/* Fallback button to unlock audio/speech permissions */}
        {!isAudioUnlocked ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleTestSound();
            }}
            className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/60 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md cursor-pointer animate-pulse"
            title="Clique para habilitar áudio e voz no navegador"
          >
            <VolumeX className="w-3.5 h-3.5 text-amber-400" />
            <span>Ativar Som</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleTestSound();
            }}
            className="px-3 py-1.5 bg-neutral-900/90 hover:bg-neutral-800 text-neutral-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors border border-neutral-700/80 shadow-md cursor-pointer"
            title="Testar Campainha e Voz Sintetizada"
          >
            <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Testar Som</span>
          </button>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleManualCall();
          }}
          className="px-3 py-1.5 bg-neutral-900/90 hover:bg-neutral-800 text-neutral-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors border border-neutral-700/80 shadow-md cursor-pointer"
          title="Chamar Senha / Repetir Chamada com Voz"
        >
          <Bell className="w-3.5 h-3.5 text-red-500 animate-pulse" />
          <span className="hidden sm:inline">Chamar Novamente</span>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleFullscreen();
          }}
          className="p-2 sm:px-3 sm:py-1.5 bg-neutral-900/90 hover:bg-neutral-800 text-neutral-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors border border-neutral-700/80 shadow-md cursor-pointer"
          title={isFullscreen ? 'Sair da Tela Cheia' : 'Tela Cheia (Modo TV)'}
        >
          {isFullscreen ? (
            <Minimize className="w-4 h-4 text-amber-400" />
          ) : (
            <Maximize className="w-4 h-4 text-amber-400" />
          )}
          <span className="hidden sm:inline">{isFullscreen ? 'Sair da Tela Cheia' : 'Modo TV'}</span>
        </button>
      </div>

      {/* PAINEL FÍSICO DE LED (Carcaça Externa Industrial) */}
      <div className="w-full max-w-3xl lg:max-w-4xl relative z-10 flex flex-col items-center">
        {/* Carcaça Preta Externa de Parede */}
        <div className="w-full bg-[#0b0b0e] border-[10px] sm:border-[16px] md:border-[20px] border-neutral-900 rounded-3xl sm:rounded-[36px] shadow-[0_20px_70px_rgba(0,0,0,0.95),inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-8px_20px_rgba(0,0,0,0.95)] p-4 sm:p-8 flex flex-col items-center justify-center relative">
          {/* Parafusos/Fixadores nos 4 cantos da carcaça física */}
          <div className="absolute top-2 left-2 sm:top-3 sm:left-3 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-neutral-700 border border-neutral-800 shadow-inner" />
          <div className="absolute top-2 right-2 sm:top-3 sm:right-3 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-neutral-700 border border-neutral-800 shadow-inner" />
          <div className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-neutral-700 border border-neutral-800 shadow-inner" />
          <div className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-neutral-700 border border-neutral-800 shadow-inner" />

          {/* Acrílico Fumê do Painel com Grid de Matriz LED */}
          <div
            className="w-full bg-black/95 border-2 border-neutral-800/80 rounded-2xl sm:rounded-3xl p-6 sm:p-10 md:p-14 flex flex-col items-center justify-center relative overflow-hidden shadow-inner"
            style={{
              backgroundImage: 'radial-gradient(rgba(35, 5, 5, 0.45) 1.5px, transparent 1.5px)',
              backgroundSize: '14px 14px',
            }}
          >
            {/* Scanlines sutis de acrílico fumê */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_50%,transparent_50%)] bg-[length:100%_4px] pointer-events-none opacity-40" />

            {/* Cabeçalho Branco Puro em Caixa Alta: "SENHA" */}
            <div className="w-full text-center pb-4 sm:pb-6 border-b-2 sm:border-b-4 border-neutral-800/90 relative z-10">
              <h1 className="text-white font-black tracking-[0.25em] sm:tracking-[0.4em] md:tracking-[0.5em] text-3xl sm:text-5xl md:text-6xl uppercase leading-none drop-shadow-[0_2px_12px_rgba(255,255,255,0.35)] pl-[0.25em] sm:pl-[0.4em] md:pl-[0.5em]">
                SENHA
              </h1>
            </div>

            {/* Display Numérico Digital LED Gigante */}
            <div className="relative py-6 sm:py-10 md:py-14 w-full flex items-center justify-center overflow-hidden">
              {/* Fantasma dos dígitos 888 desligados (típico de displays físicos 7 segmentos) */}
              <div
                aria-hidden="true"
                className="absolute inset-0 flex items-center justify-center font-mono font-black tabular-nums tracking-widest text-7xl sm:text-9xl md:text-[13rem] lg:text-[16rem] leading-none select-none pointer-events-none text-[#1b0505] opacity-25"
              >
                888
              </div>

              {/* Dígitos Ativos em LED Vermelho Brilhante */}
              <div
                className={`relative z-10 font-mono font-black tabular-nums tracking-widest text-center transition-all duration-100 select-none ${
                  isBlinking && !isLedLit ? 'opacity-10 scale-[0.99]' : 'opacity-100 scale-100'
                }`}
                style={{
                  color: hasActiveTicket ? '#ff2020' : '#4a0808',
                  textShadow:
                    hasActiveTicket && (!isBlinking || isLedLit)
                      ? '0 0 25px #ff2020, 0 0 50px rgba(255,30,30,0.85), 0 0 80px rgba(255,0,0,0.5)'
                      : hasActiveTicket
                      ? '0 0 6px rgba(100,10,10,0.2)'
                      : '0 0 10px rgba(255,0,0,0.2)',
                }}
              >
                <span className="text-7xl sm:text-9xl md:text-[13rem] lg:text-[16rem] leading-none block">
                  {formattedNumber}
                </span>
              </div>
            </div>

            {/* Sutil moldura inferior fumê */}
            <div className="w-full pt-3 sm:pt-4 border-t border-neutral-900 flex items-center justify-between text-[9px] sm:text-[10px] font-mono text-neutral-600 uppercase tracking-widest relative z-10">
              <span>PAINEL DIGITAL GUICHÊ</span>
              <span className="flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isBlinking
                      ? 'bg-red-500 animate-ping'
                      : hasActiveTicket
                      ? 'bg-red-600'
                      : 'bg-neutral-800'
                  }`}
                />
                <span>{isBlinking ? 'CHAMANDO...' : hasActiveTicket ? 'ONLINE' : 'STANDBY'}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
