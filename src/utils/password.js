// 密码强度校验（与后端 security.check_password_strength 保持一致）
export const PASSWORD_MIN_LENGTH = 5

// 返回 null 表示通过；否则返回错误提示
export function passwordStrengthError(pwd) {
  if (!pwd) return '密码不能为空'
  if (pwd.length < PASSWORD_MIN_LENGTH) return `密码长度至少 ${PASSWORD_MIN_LENGTH} 位`
  let types = 0
  if (/[a-z]/.test(pwd)) types++
  if (/[A-Z]/.test(pwd)) types++
  if (/\d/.test(pwd)) types++
  if (/[^A-Za-z0-9]/.test(pwd)) types++
  if (types < 3) return '密码需包含大写字母、小写字母、数字、特殊字符中的至少 3 种'
  return null
}
