'use client';

import { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

const baseClasses =
  'w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm text-gray-100 placeholder-gray-500 outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent';

interface FieldProps {
  label: string;
  hint?: string;
}

export function Input({
  label,
  hint,
  className = '',
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & FieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-gray-300">{label}</span>
      <input className={`${baseClasses} ${className}`} {...rest} />
      {hint && <span className="mt-1 block text-xs text-gray-500">{hint}</span>}
    </label>
  );
}

export function TextArea({
  label,
  hint,
  className = '',
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-gray-300">{label}</span>
      <textarea className={`${baseClasses} min-h-[120px] resize-y ${className}`} {...rest} />
      {hint && <span className="mt-1 block text-xs text-gray-500">{hint}</span>}
    </label>
  );
}
