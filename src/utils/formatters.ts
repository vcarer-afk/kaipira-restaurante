/**
 * Utility functions for mask validation, uppercase enforcement, currency, and ViaCEP.
 * Adheres strictly to Restaurante Kaipira business rules.
 */

// Format phone number with mandatory mask: (99) 9-9999-9999 or (99) 9999-9999
export function formatPhone(value: string): string {
  if (!value) return '';
  const digits = value.replace(/\D/g, '').slice(0, 11);
  
  if (digits.length <= 2) {
    return digits.length ? `(${digits}` : '';
  }
  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  if (digits.length <= 10) {
    // Landline format: (99) 9999-9999
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  // Mobile format with 9 digits: (99) 9-9999-9999
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
}

// Clean phone digits
export function cleanDigits(value: string): string {
  return value.replace(/\D/g, '');
}

// Format CEP with mask: 99999-999
export function formatCep(value: string): string {
  if (!value) return '';
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

// Enforce UPPERCASE on all input fields, except emails
export function forceUppercase(value: string, isEmail = false): string {
  if (isEmail) return value;
  return value ? value.toUpperCase() : '';
}

// Currency BRL format
export function formatBRL(value: number | undefined | null): string {
  const num = typeof value === 'number' && !isNaN(value) ? value : 0;
  return num.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

// Format date and time
export function formatDateTime(isoString: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export function formatTime(isoString: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

// ViaCEP auto-lookup
export interface ViaCepResult {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

export async function consultarViaCep(cep: string): Promise<ViaCepResult | null> {
  const digits = cleanDigits(cep);
  if (digits.length !== 8) return null;

  try {
    const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    const data: ViaCepResult = await response.json();
    if (data.erro) return null;

    return {
      cep: data.cep,
      logradouro: forceUppercase(data.logradouro || ''),
      complemento: forceUppercase(data.complemento || ''),
      bairro: forceUppercase(data.bairro || ''),
      localidade: forceUppercase(data.localidade || 'PIRACICABA'),
      uf: forceUppercase(data.uf || 'SP'),
    };
  } catch (err) {
    console.warn('Erro ao consultar ViaCEP:', err);
    return null;
  }
}

// Play notification chime using Web Audio API
export function playAlertChime(type: 'order' | 'ready' | 'call' = 'order') {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    
    if (type === 'ready') {
      // High ding-dong chime for kitchen / LED ticket
      const notes = [587.33, 880, 1174.66]; // D5, A5, D6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);
        gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.12);
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + idx * 0.12 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.12);
        osc.stop(ctx.currentTime + idx * 0.12 + 0.5);
      });
    } else {
      // Bell chime for new order
      const notes = [440, 659.25]; // A4, E5
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.15);
        gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.15);
        gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + idx * 0.15 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.15 + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.15);
        osc.stop(ctx.currentTime + idx * 0.15 + 0.55);
      });
    }
  } catch {
    // Ignore audio restriction if user hasn't interacted yet
  }
}

/**
 * Normalização universal de canal de salão (salão vs salao vs mesa_id)
 * Considera como salão qualquer pedido com mesa_id ou cujo tipo contenha 'sal' (após normalização NFD)
 */
export function isSalaoPedido(p: { tipo?: string; mesa_id?: number | string | null } | null | undefined): boolean {
  if (!p) return false;
  if (p.mesa_id !== undefined && p.mesa_id !== null && p.mesa_id !== '') return true;
  const t = (p.tipo || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return t.includes('sal');
}
