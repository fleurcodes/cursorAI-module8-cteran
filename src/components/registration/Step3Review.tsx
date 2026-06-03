import type { RegistrationFormData, SubmitStatus } from './types';

interface Step3Props {
  data: RegistrationFormData;
  onSubmit: () => void;
  onPrevious: () => void;
  submitStatus: SubmitStatus;
  submitError: string;
}

export default function Step3Review({
  data,
  onSubmit,
  onPrevious,
  submitStatus,
  submitError,
}: Step3Props) {
  const isLoading = submitStatus === 'loading';

  return (
    <div data-testid="step-3" role="group" aria-labelledby="step3-heading">
      <h2
        id="step3-heading"
        className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6"
      >
        Review &amp; Submit
      </h2>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700 mb-6">
        <ReviewRow label="Full Name" value={data.step1.fullName} testId="review-fullName" />
        <ReviewRow label="Email" value={data.step1.email} testId="review-email" />
        <ReviewRow label="Password" value="••••••••" testId="review-password" />
        <ReviewRow label="Username" value={data.step2.username} testId="review-username" />
        {data.step2.bio && (
          <ReviewRow label="Bio" value={data.step2.bio} testId="review-bio" />
        )}
      </div>

      {submitError && (
        <div
          data-testid="submit-error"
          role="alert"
          aria-live="assertive"
          className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400"
        >
          {submitError}
        </div>
      )}

      <div className="flex justify-between">
        <button
          type="button"
          data-testid="btn-previous"
          onClick={onPrevious}
          disabled={isLoading}
          className="px-6 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>

        <button
          type="submit"
          data-testid="btn-submit"
          onClick={onSubmit}
          disabled={isLoading}
          aria-busy={isLoading}
          className="px-6 py-2.5 rounded-lg bg-primary text-white font-medium text-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isLoading && (
            <svg
              data-testid="loading-spinner"
              className="w-4 h-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          )}
          {isLoading ? 'Submitting…' : 'Create Account'}
        </button>
      </div>
    </div>
  );
}

function ReviewRow({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId: string;
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <span className="w-28 text-sm font-medium text-gray-500 dark:text-gray-400 flex-shrink-0">
        {label}
      </span>
      <span data-testid={testId} className="text-sm text-gray-900 dark:text-gray-100">
        {value}
      </span>
    </div>
  );
}
