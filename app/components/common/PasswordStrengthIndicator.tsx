import { useState, useEffect } from "react";

interface PasswordRequirement {
  label: string;
  met: boolean;
}

interface PasswordStrengthIndicatorProps {
  password: string;
  t: (key: string) => string;
}

export function PasswordStrengthIndicator({ password, t }: PasswordStrengthIndicatorProps) {
  const [requirements, setRequirements] = useState<PasswordRequirement[]>([]);

  useEffect(() => {
    setRequirements([
      {
        label: t('password_req_length'),
        met: password.length >= 8,
      },
      {
        label: t('password_req_uppercase'),
        met: /[A-Z]/.test(password),
      },
      {
        label: t('password_req_lowercase'),
        met: /[a-z]/.test(password),
      },
      {
        label: t('password_req_number'),
        met: /[0-9]/.test(password),
      },
      {
        label: t('password_req_special'),
        met: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>?]/.test(password),
      },
    ]);
  }, [password, t]);

  return (
    <div className="mt-2 space-y-1">
      {requirements.map((req, index) => (
        <div
          key={index}
          className={`flex items-center gap-2 text-xs transition-colors ${
            req.met ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {req.met ? (
              <polyline points="20 6 9 17 4 12" />
            ) : (
              <circle cx="12" cy="12" r="10" />
            )}
          </svg>
          <span>{req.label}</span>
        </div>
      ))}
    </div>
  );
}
