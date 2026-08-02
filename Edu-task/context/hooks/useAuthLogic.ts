import { User } from '@/Edu-task/types/user';
import { firebaseAuthService } from '@/Edu-task/services/firebaseAuthService';

interface AuthLogicProps {
  setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>;
  setIsAuthenticated: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useAuthLogic({ setCurrentUser, setIsAuthenticated }: AuthLogicProps) {

  // NOTE: for the three real Firebase flows below we deliberately do NOT set
  // currentUser / activeRole / isAuthenticated here. The single onAuthChange
  // listener in AppContext derives those from the auth state (and the live
  // users snapshot), so setting them here too raced against that effect and
  // could momentarily show a stale profile built from the cached users list.

  const loginWithGoogle = async () => {
    await firebaseAuthService.loginWithGoogle();
  };

  const loginWithFirebase = async (email: string, pass: string) => {
    await firebaseAuthService.login(email, pass);
  };

  const registerWithFirebase = async (email: string, pass: string, fullName: string, deptId: string, deptName: string) => {
    // register() already writes the profile to Firestore; the auth-state effect
    // picks it up, so no extra saveUser / manual state update is needed here.
    await firebaseAuthService.register(email, pass, fullName, deptId, deptName);
  };

  // Signing out is the one flow that clears state directly: the auth listener
  // fires too, but doing it here avoids a frame of stale user data on screen.
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
    logout,
  };
}
