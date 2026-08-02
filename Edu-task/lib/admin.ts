export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  
  const adminEmailsStr = process.env.NEXT_PUBLIC_ADMIN_EMAILS || 'admin@gmail.com';
  const adminEmails = adminEmailsStr.split(',').map(e => e.trim().toLowerCase());
  
  return adminEmails.includes(email.toLowerCase());
}
