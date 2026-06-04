import { useMemo, useState } from 'react';
import type { Step1Data } from './types';
import { validateStep1 } from './validators';
import FormField from './FormField';

interface Step1Props {
  data: Step1Data;
  onChange: (data: Step1Data) => void;
  onNext: () => void;
}

export default function Step1AccountInfo({ data, onChange, onNext }: Step1Props) {
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const errors = useMemo(() => {
    if (Object.keys(touched).length === 0) return {};
    return validateStep1(data).errors;
  }, [data, touched]);

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const getError = (field: string): string =>
    touched[field] ? (errors[field] ?? '') : '';

  const handleNext = () => {
    const allTouched = {
      fullName: true,
      email: true,
      password: true,
      confirmPassword: true,
    };
    setTouched(allTouched);

    const result = validateStep1(data);

    if (!result.valid) {
      const firstErrorField = ['fullName', 'email', 'password', 'confirmPassword'].find(
        (f) => result.errors[f],
      );
      if (firstErrorField) {
        const el = document.getElementById(firstErrorField);
        el?.focus();
      }
      return;
    }
    onNext();
  };

  return (
    <div data-testid="step-1" role="group" aria-labelledby="step1-heading">
      <h2
        id="step1-heading"
        className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6"
      >
        Account Information
      </h2>

      <div className="flex flex-col gap-4">
        <FormField
          id="fullName"
          label="Full Name"
          value={data.fullName}
          onChange={(v) => onChange({ ...data, fullName: v })}
          onBlur={() => handleBlur('fullName')}
          placeholder="Jane Doe"
          error={getError('fullName')}
          required
          autoComplete="name"
        />

        <FormField
          id="email"
          label="Email Address"
          type="email"
          value={data.email}
          onChange={(v) => onChange({ ...data, email: v })}
          onBlur={() => handleBlur('email')}
          placeholder="jane@example.com"
          error={getError('email')}
          required
          autoComplete="email"
        />

        <FormField
          id="password"
          label="Password"
          type="password"
          value={data.password}
          onChange={(v) => onChange({ ...data, password: v })}
          onBlur={() => handleBlur('password')}
          placeholder="At least 8 characters"
          error={getError('password')}
          required
          maxLength={64}
          autoComplete="new-password"
        />

        <FormField
          id="confirmPassword"
          label="Confirm Password"
          type="password"
          value={data.confirmPassword}
          onChange={(v) => onChange({ ...data, confirmPassword: v })}
          onBlur={() => handleBlur('confirmPassword')}
          placeholder="Repeat your password"
          error={getError('confirmPassword')}
          required
          maxLength={64}
          autoComplete="new-password"
        />
      </div>

      <div className="mt-8 flex justify-end">
        <button
          type="button"
          data-testid="btn-next"
          onClick={handleNext}
          className="px-6 py-2.5 rounded-lg bg-primary text-white font-medium text-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
}
