// Password rules shared by sign up and forgot password:
//  - at least 6 characters
//  - at least one letter (a-z or A-Z)
const PASSWORD_MIN_LENGTH = 6;
const PASSWORD_ERROR =
  'Password must be at least 6 characters long and include at least one letter (a-z or A-Z).';

// Returns an error message, or null when the password is valid.
function validatePassword(password) {
  if (typeof password !== 'string') return PASSWORD_ERROR;
  if (password.length < PASSWORD_MIN_LENGTH) return PASSWORD_ERROR;
  if (!/[a-zA-Z]/.test(password)) return PASSWORD_ERROR;
  return null;
}

module.exports = { validatePassword, PASSWORD_ERROR, PASSWORD_MIN_LENGTH };
