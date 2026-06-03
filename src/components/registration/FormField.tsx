interface FormFieldProps {
  id: string;
  label: string;
  type?: 'text' | 'email' | 'password' | 'textarea';
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
  maxLength?: number;
  autoComplete?: string;
}

export default function FormField({
  id,
  label,
  type = 'text',
  value,
  onChange,
  onBlur,
  placeholder,
  error,
  required,
  maxLength,
  autoComplete,
}: FormFieldProps) {
  const errorId = `${id}-error`;
  const hasError = Boolean(error);

  const inputClass = `block w-full rounded-lg border px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary transition-colors duration-150 ${
    hasError
      ? 'border-red-500 focus:border-red-500 focus:ring-red-400'
      : 'border-gray-300 dark:border-gray-600 focus:border-primary'
  }`;

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-sm font-medium text-gray-900 dark:text-gray-100"
      >
        {label}
        {required && (
          <span aria-hidden="true" className="ml-1 text-red-500">
            *
          </span>
        )}
      </label>

      {type === 'textarea' ? (
        <div>
          <textarea
            id={id}
            data-testid={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            placeholder={placeholder}
            maxLength={maxLength}
            required={required}
            aria-invalid={hasError}
            aria-describedby={hasError ? errorId : undefined}
            aria-required={required}
            rows={3}
            className={`${inputClass} resize-none`}
          />
          {maxLength !== undefined && (
            <p
              className="text-xs text-gray-400 dark:text-gray-500 text-right mt-0.5"
              aria-live="polite"
            >
              {value.length}/{maxLength}
            </p>
          )}
        </div>
      ) : (
        <input
          id={id}
          data-testid={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          maxLength={maxLength}
          required={required}
          aria-invalid={hasError}
          aria-describedby={hasError ? errorId : undefined}
          aria-required={required}
          autoComplete={autoComplete}
          className={inputClass}
        />
      )}

      {hasError && (
        <p
          id={errorId}
          data-testid={`${id}-error`}
          role="alert"
          aria-live="assertive"
          className="text-sm text-red-500"
        >
          {error}
        </p>
      )}
    </div>
  );
}
