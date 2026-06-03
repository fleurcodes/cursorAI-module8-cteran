import type { Step1Data, Step2Data } from './types';

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export function validateStep1(data: Step1Data): ValidationResult {
  const errors: Record<string, string> = {};

  if (!data.fullName.trim()) {
    errors.fullName = 'Full name is required';
  } else if (data.fullName.trim().length < 2) {
    errors.fullName = 'Full name must be at least 2 characters';
  } else if (data.fullName.trim().length > 50) {
    errors.fullName = 'Full name must be 50 characters or fewer';
  }

  if (!data.email.trim()) {
    errors.email = 'Email is required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = 'Enter a valid email address';
  }

  if (!data.password) {
    errors.password = 'Password is required';
  } else if (data.password.length < 8) {
    errors.password = 'Password must be at least 8 characters';
  } else if (data.password.length > 64) {
    errors.password = 'Password must be 64 characters or fewer';
  } else if (!/[A-Z]/.test(data.password)) {
    errors.password = 'Password must contain at least one uppercase letter';
  } else if (!/[0-9]/.test(data.password)) {
    errors.password = 'Password must contain at least one number';
  } else if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(data.password)) {
    errors.password = 'Password must contain at least one special character';
  }

  if (!data.confirmPassword) {
    errors.confirmPassword = 'Confirm password is required';
  } else if (data.confirmPassword !== data.password) {
    errors.confirmPassword = 'Passwords do not match';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateStep2(data: Step2Data): ValidationResult {
  const errors: Record<string, string> = {};

  if (!data.username.trim()) {
    errors.username = 'Username is required';
  } else if (data.username.trim().length < 3) {
    errors.username = 'Username must be at least 3 characters';
  } else if (data.username.trim().length > 20) {
    errors.username = 'Username must be 20 characters or fewer';
  } else if (!/^[a-zA-Z0-9_]+$/.test(data.username)) {
    errors.username = 'Username may only contain letters, numbers, and underscores';
  }

  if (data.bio.length > 160) {
    errors.bio = 'Bio must be 160 characters or fewer';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
