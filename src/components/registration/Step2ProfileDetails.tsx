import { useMemo, useState } from 'react';
import type { Step2Data } from './types';
import { validateStep2 } from './validators';
import FormField from './FormField';

interface Step2Props {
  data: Step2Data;
  onChange: (data: Step2Data) => void;
  onNext: () => void;
  onPrevious: () => void;
}

export default function Step2ProfileDetails({
  data,
  onChange,
  onNext,
  onPrevious,
}: Step2Props) {
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const errors = useMemo(() => {
    if (Object.keys(touched).length === 0) return {};
    return validateStep2(data).errors;
  }, [data, touched]);

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const getError = (field: string): string =>
    touched[field] ? (errors[field] ?? '') : '';

  const handleNext = () => {
    setTouched({ username: true, bio: true });
    const result = validateStep2(data);

    if (!result.valid) {
      const firstErrorField = ['username', 'bio'].find((f) => result.errors[f]);
      if (firstErrorField) {
        const el = document.getElementById(firstErrorField);
        el?.focus();
      }
      return;
    }
    onNext();
  };

  return (
    <div data-testid="step-2" role="group" aria-labelledby="step2-heading">
      <h2
        id="step2-heading"
        className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6"
      >
        Profile Details
      </h2>

      <div className="flex flex-col gap-4">
        <FormField
          id="username"
          label="Username"
          value={data.username}
          onChange={(v) => onChange({ ...data, username: v })}
          onBlur={() => handleBlur('username')}
          placeholder="jane_doe"
          error={getError('username')}
          required
          autoComplete="username"
        />

        <FormField
          id="bio"
          label="Bio"
          type="textarea"
          value={data.bio}
          onChange={(v) => onChange({ ...data, bio: v })}
          onBlur={() => handleBlur('bio')}
          placeholder="Tell us a little about yourself (optional)"
          error={getError('bio')}
          maxLength={160}
        />
      </div>

      <div className="mt-8 flex justify-between">
        <button
          type="button"
          data-testid="btn-previous"
          onClick={onPrevious}
          className="px-6 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors duration-150"
        >
          Previous
        </button>
        <button
          type="button"
          data-testid="btn-next"
          onClick={handleNext}
          className="px-6 py-2.5 rounded-lg bg-primary text-white font-medium text-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors duration-150"
        >
          Next
        </button>
      </div>
    </div>
  );
}
