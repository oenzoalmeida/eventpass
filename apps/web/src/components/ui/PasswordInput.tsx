import { forwardRef, useId, useState, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export interface PasswordInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
}

/** Campo de senha com rótulo, erro e botão-olho (mostrar/ocultar). Só apresentação. */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ label, hint, error, id, className, ...props }, ref) {
    const autoId = useId();
    const inputId = id ?? autoId;
    const hintId = hint ? `${inputId}-hint` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;
    const [show, setShow] = useState(false);

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-sm font-medium text-fg">
          {label}
          {props.required && (
            <span className="text-danger" aria-hidden="true">
              {' '}*
            </span>
          )}
        </label>
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={show ? 'text' : 'password'}
            aria-invalid={error ? true : undefined}
            aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
            className={cn(
              'h-11 w-full rounded-lg border bg-surface px-3 pr-11 text-sm text-fg placeholder:text-fg-muted',
              error ? 'border-danger' : 'border-border-strong',
              className,
            )}
            {...props}
          />
          <button
            type="button"
            aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
            aria-pressed={show}
            onClick={() => setShow((v) => !v)}
            className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
              <circle cx="12" cy="12" r="3" />
              {show && <line x1="4" y1="20" x2="20" y2="4" />}
            </svg>
          </button>
        </div>
        {hint && !error && (
          <p id={hintId} className="text-xs text-fg-muted">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
      </div>
    );
  },
);
