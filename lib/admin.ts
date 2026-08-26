export const isAdmin = () => {
  // Проверка через пароль из .env
  return process.env.ADMIN_PASSWORD === 'your_admin_password';
};