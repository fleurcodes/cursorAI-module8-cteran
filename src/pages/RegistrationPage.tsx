import { useEffect } from 'react';
import RegistrationForm from '../components/registration/RegistrationForm';
import type { RegistrationFormData } from '../components/registration/types';
import { register } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';

export default function RegistrationPage() {
  const { isAuthenticated, setUser } = useAuth();

  // Redirect already-authenticated users to dashboard
  useEffect(() => {
    if (isAuthenticated) {
      window.location.hash = '#/team';
    }
  }, [isAuthenticated]);

  const handleRegister = async (formData: RegistrationFormData) => {
    const authUser = await register({
      name: formData.step1.fullName,
      email: formData.step1.email,
      password: formData.step1.password,
      username: formData.step2.username,
      bio: formData.step2.bio,
    });
    setUser(authUser);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-8">
        <div className="mb-8 text-center">
          <h1
            data-testid="registration-title"
            className="text-3xl font-bold text-gray-900 dark:text-gray-100"
          >
            Create an Account
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">
            Fill in the form below to get started.
          </p>
        </div>

        <RegistrationForm onSubmit={handleRegister} />
      </div>
    </div>
  );
}
