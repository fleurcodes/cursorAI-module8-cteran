export interface Step1Data {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface Step2Data {
  username: string;
  bio: string;
}

export interface RegistrationFormData {
  step1: Step1Data;
  step2: Step2Data;
}

export interface FieldError {
  field: string;
  message: string;
}

export type RegistrationStep = 1 | 2 | 3;

export type SubmitStatus = 'idle' | 'loading' | 'success' | 'error';
