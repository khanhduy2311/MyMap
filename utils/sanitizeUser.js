function sanitizeUser(user) {
  if (!user) return user;
  const {
    password,
    resetPasswordToken,
    resetPasswordExpires,
    ...safe
  } = user;
  return safe;
}

function sanitizeUsers(users) {
  if (!Array.isArray(users)) return [];
  return users.map(sanitizeUser);
}

module.exports = { sanitizeUser, sanitizeUsers };
