import { User, RoleType } from '@/Edu-task/types/user';
import { storage } from '@/Edu-task/lib/storage';
import { firebaseService } from '@/Edu-task/services/firebaseService';
import { firebaseAuthService } from '@/Edu-task/services/firebaseAuthService';

interface AuthLogicProps {
  users: User[];
  setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>;
  setActiveRole: React.Dispatch<React.SetStateAction<RoleType>>;
  setIsAuthenticated: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useAuthLogic({ users, setCurrentUser, setActiveRole, setIsAuthenticated }: AuthLogicProps) {
  
  const loginWithGoogle = async () => {
    const { userProfile } = await firebaseAuthService.loginWithGoogle();
    setIsAuthenticated(true);
    setCurrentUser(userProfile);
    setActiveRole(userProfile.activeRole || userProfile.roles[0] || 'TEACHER');
  };

  const loginWithFirebase = async (email: string, pass: string) => {
    console.log('loginWithFirebase called with:', email);
    await firebaseAuthService.login(email, pass);
    console.log('loginWithFirebase login success!');
    setIsAuthenticated(true);
    const match = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    console.log('loginWithFirebase match:', !!match, users.length);
    if (match) {
      setCurrentUser(match);
      setActiveRole(match.activeRole || match.roles[0]);
    } else {
      console.log('NO MATCH in loginWithFirebase for', email);
    }
  };

  const registerWithFirebase = async (email: string, pass: string, fullName: string, deptId: string, deptName: string) => {
    const newProfile = await firebaseAuthService.register(email, pass, fullName, deptId, deptName);
    setIsAuthenticated(true);
    setCurrentUser(newProfile);
    setActiveRole(newProfile.roles[0]);
    await firebaseService.saveUser(newProfile);
  };

  const loginAsDemoUser = (email: string) => {
    let match = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!match && email === 'admin@gmail.com') {
      match = users.find(u => u.id === 'USR_ADMIN');
    }
    if (match) {
      setIsAuthenticated(true);
      setCurrentUser(match);
      setActiveRole(match.activeRole || match.roles[0]);
      storage.setCurrentUserId(match.id);
    }
  };

  const logout = async () => {
    try {
      await firebaseAuthService.logout();
    } catch {
      // ignore
    }
    setIsAuthenticated(false);
    setCurrentUser(null);
  };

  return {
    loginWithGoogle,
    loginWithFirebase,
    registerWithFirebase,
    loginAsDemoUser,
    logout,
  };
}
