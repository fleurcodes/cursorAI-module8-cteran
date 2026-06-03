import { useState } from 'react';
import type { RegistrationFormData, RegistrationStep, Step1Data, Step2Data, SubmitStatus } from './types';
import StepIndicator from './StepIndicator';
import Step1AccountInfo from './Step1AccountInfo';
import Step2ProfileDetails from './Step2ProfileDetails';
import Step3Review from './Step3Review';

const STEP_LABELS = ['Account Info', 'Profile Details', 'Review'];

const EMPTY_STEP1: Step1Data = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
};

const EMPTY_STEP2: Step2Data = {
  username: '',
  bio: '',
};

interface RegistrationFormProps {
  /** Injected for testing. Defaults to a real API call. */
  onSubmit?: (data: RegistrationFormData) => Promise<unknown>;
}

export default function RegistrationForm({ onSubmit }: RegistrationFormProps) {
  const [step, setStep] = useState<RegistrationStep>(1);
  const [step1Data, setStep1Data] = useState<Step1Data>(EMPTY_STEP1);
  const [step2Data, setStep2Data] = useState<Step2Data>(EMPTY_STEP2);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [submitError, setSubmitError] = useState('');

  const formData: RegistrationFormData = { step1: step1Data, step2: step2Data };

  const handleSubmit = async () => {
    if (submitStatus === 'loading') return; // prevent duplicate submissions
    setSubmitStatus('loading');
    setSubmitError('');

    try {
      if (onSubmit) {
        await onSubmit(formData);
      } else {
        // Default: simulate a POST /api/register call
        const response = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: step1Data.fullName,
            email: step1Data.email,
            password: step1Data.password,
          }),
        });

        if (!response.ok) {
          const body = (await response.json()) as { message?: string };
          throw new Error(body.message ?? 'Registration failed. Please try again.');
        }
      }
      setSubmitStatus('success');
    } catch (err) {
      setSubmitStatus('error');
      setSubmitError(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.',
      );
    }
  };

  if (submitStatus === 'success') {
    return (
      <div
        data-testid="success-screen"
        role="status"
        aria-live="polite"
        className="text-center py-12"
      >
        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-green-600 dark:text-green-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2
          data-testid="success-heading"
          className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2"
        >
          Account Created!
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          Welcome aboard, {step1Data.fullName}. Your account is ready.
        </p>
        <a
          data-testid="link-go-to-dashboard"
          href="#/team"
          className="inline-flex items-center px-6 py-2.5 rounded-lg bg-primary text-white font-medium text-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors duration-150"
        >
          Go to team dashboard
        </a>
      </div>
    );
  }

  return (
    <div data-testid="registration-form" className="w-full max-w-lg mx-auto">
      <StepIndicator currentStep={step} totalSteps={3} stepLabels={STEP_LABELS} />

      {step === 1 && (
        <Step1AccountInfo
          data={step1Data}
          onChange={setStep1Data}
          onNext={() => setStep(2)}
        />
      )}

      {step === 2 && (
        <Step2ProfileDetails
          data={step2Data}
          onChange={setStep2Data}
          onNext={() => setStep(3)}
          onPrevious={() => setStep(1)}
        />
      )}

      {step === 3 && (
        <Step3Review
          data={formData}
          onSubmit={handleSubmit}
          onPrevious={() => setStep(2)}
          submitStatus={submitStatus}
          submitError={submitError}
        />
      )}
    </div>
  );
}
