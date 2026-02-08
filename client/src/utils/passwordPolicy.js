export const PASSWORD_REQUIREMENTS = [
  {
    id: 'minLength',
    label: 'At least 8 characters',
    test: (password) => password.length >= 8,
  },
  {
    id: 'uppercase',
    label: 'At least one uppercase letter',
    test: (password) => /[A-Z]/.test(password),
  },
  {
    id: 'lowercase',
    label: 'At least one lowercase letter',
    test: (password) => /[a-z]/.test(password),
  },
  {
    id: 'number',
    label: 'At least one number',
    test: (password) => /\d/.test(password),
  },
  {
    id: 'special',
    label: 'At least one special character',
    test: (password) => /[^A-Za-z0-9]/.test(password),
  },
];

export function getPasswordRequirementStatus(password = '') {
  return PASSWORD_REQUIREMENTS.map((requirement) => ({
    id: requirement.id,
    label: requirement.label,
    met: requirement.test(password),
  }));
}

export function getMissingPasswordRequirements(password = '') {
  return getPasswordRequirementStatus(password)
    .filter((requirement) => !requirement.met)
    .map((requirement) => requirement.label);
}

export function isPasswordPolicyCompliant(password = '') {
  return getMissingPasswordRequirements(password).length === 0;
}
