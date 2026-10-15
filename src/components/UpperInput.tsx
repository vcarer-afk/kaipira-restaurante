import React from 'react';
import { formatPhone, formatCep, forceUppercase } from '../utils/formatters';

interface UpperInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string;
  maskType?: 'phone' | 'cep' | 'none';
  isEmail?: boolean;
  value: string;
  onChange: (value: any) => void;
  error?: string;
  helperText?: string;
}

export const UpperInput: React.FC<UpperInputProps> = ({
  label,
  maskType = 'none',
  isEmail = false,
  value,
  onChange,
  error,
  helperText,
  className = '',
  ...props
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;
    if (maskType === 'phone') {
      raw = formatPhone(raw);
    } else if (maskType === 'cep') {
      raw = formatCep(raw);
    } else {
      raw = forceUppercase(raw, isEmail);
    }
    const hybrid: any = new String(raw);
    hybrid.target = { value: raw };
    hybrid.currentTarget = { value: raw };
    hybrid.valueOf = () => raw;
    hybrid.toString = () => raw;
    onChange(hybrid);
  };

  return (
    <div className="flex flex-col gap-1 w-full text-left">
      {label && (
        <label className="text-xs font-semibold tracking-wider text-neutral-300">
          {label}
        </label>
      )}
      <input
        {...props}
        value={value}
        onChange={handleChange}
        className={`w-full px-3 py-2 bg-neutral-800 border text-neutral-100 rounded-lg text-sm transition-colors focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder:text-neutral-500 ${
          error ? 'border-red-500' : 'border-neutral-700 hover:border-neutral-600'
        } ${isEmail ? '' : 'uppercase'} ${className}`}
      />
      {error && <span className="text-xs text-red-400 font-medium">{error}</span>}
      {helperText && !error && <span className="text-xs text-neutral-400">{helperText}</span>}
    </div>
  );
};

interface UpperTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  label?: string;
  value: string;
  onChange: (value: any) => void;
  error?: string;
}

export const UpperTextarea: React.FC<UpperTextareaProps> = ({
  label,
  value,
  onChange,
  error,
  className = '',
  ...props
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const raw = forceUppercase(e.target.value);
    const hybrid: any = new String(raw);
    hybrid.target = { value: raw };
    hybrid.currentTarget = { value: raw };
    hybrid.valueOf = () => raw;
    hybrid.toString = () => raw;
    onChange(hybrid);
  };

  return (
    <div className="flex flex-col gap-1 w-full text-left">
      {label && (
        <label className="text-xs font-semibold tracking-wider text-neutral-300">
          {label}
        </label>
      )}
      <textarea
        {...props}
        value={value}
        onChange={handleChange}
        className={`w-full px-3 py-2 bg-neutral-800 border text-neutral-100 rounded-lg text-sm transition-colors focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder:text-neutral-500 uppercase ${
          error ? 'border-red-500' : 'border-neutral-700 hover:border-neutral-600'
        } ${className}`}
      />
      {error && <span className="text-xs text-red-400 font-medium">{error}</span>}
    </div>
  );
};
