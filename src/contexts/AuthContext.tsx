import React, {createContext, useContext, useEffect, useState} from 'react';
import {
  User,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {doc, getDoc, serverTimestamp, setDoc, updateDoc} from 'firebase/firestore';
import {ADMIN_BOOTSTRAP_EMAIL} from '../services/config/chileCatalog';
import {auth, db, handleFirestoreError, OperationType} from '../services/firebase/firebaseClient';
import {AppModule, NotificationPreferences, UserAccount, UserRole} from '../types';

const DEFAULT_PREFS: NotificationPreferences = {
  matches: true,
  messages: true,
  interests: true,
  compatibleNeeds: true,
  compatibleJobs: true,
  campaigns: true,
  payments: true,
  webPushEnabled: false,
};

interface AuthContextValue {
  firebaseUser: User | null;
  userAccount: UserAccount | null;
  authReady: boolean;
  isAdmin: boolean;
  needsEmailVerification: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  updateAccountProfile: (updates: Partial<Pick<UserAccount, 'displayName' | 'phone' | 'commune' | 'region' | 'roles' | 'activeModules' | 'notificationPrefs'>>) => Promise<void>;
  refreshAccount: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const syncUserDocument = async (user: User) => {
    if (!user.emailVerified) {
      setUserAccount(null);
      return;
    }

    const userRef = doc(db, 'users', user.uid);
    const pubRef = doc(db, 'userPublicProfiles', user.uid);
    const isBootAdmin = user.email?.toLowerCase() === ADMIN_BOOTSTRAP_EMAIL.toLowerCase();

    try {
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        const defaultRoles: UserRole[] = isBootAdmin ? ['admin', 'buyer', 'seller'] : ['buyer', 'worker'];
        const defaultModules: AppModule[] = ['commercial', 'employment'];
        const newAccount: UserAccount = {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || user.email?.split('@')[0] || 'Usuario MATCH+',
          photoUrl: user.photoURL || '',
          phone: '',
          commune: 'Castro',
          region: 'Región de Los Lagos (Piloto Chiloé)',
          roles: defaultRoles,
          activeModules: defaultModules,
          notificationPrefs: DEFAULT_PREFS,
          privacyConsentAt: new Date().toISOString(),
          status: 'active',
        };
        await setDoc(userRef, {
          ...newAccount,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await setDoc(pubRef, {
          uid: user.uid,
          displayName: newAccount.displayName,
          photoUrl: newAccount.photoUrl || '',
          commune: newAccount.commune,
          region: newAccount.region,
          verified: false,
          updatedAt: serverTimestamp(),
        });
        setUserAccount(newAccount);
      } else {
        const data = snap.data() as UserAccount;
        setUserAccount({
          ...data,
          notificationPrefs: data.notificationPrefs || DEFAULT_PREFS,
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          await syncUserDocument(user);
        } catch (err) {
          console.error('Error syncing user doc:', err);
        }
      } else {
        setUserAccount(null);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const signInWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const registerWithEmail = async (email: string, password: string, displayName: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, {displayName});
    await sendEmailVerification(cred.user);
  };

  const sendPasswordReset = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const resendVerification = async () => {
    if (auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
    }
  };

  const updateAccountProfile = async (
    updates: Partial<
      Pick<
        UserAccount,
        'displayName' | 'phone' | 'commune' | 'region' | 'roles' | 'activeModules' | 'notificationPrefs'
      >
    >
  ) => {
    if (!firebaseUser) return;
    const safeRoles = updates.roles?.filter((r) => r !== 'admin' && r !== 'moderator');
    const cleanUpdates = {
      ...updates,
      ...(safeRoles && safeRoles.length > 0 ? {roles: safeRoles} : {}),
      updatedAt: serverTimestamp(),
    };
    const userRef = doc(db, 'users', firebaseUser.uid);
    try {
      await updateDoc(userRef, cleanUpdates);
      if (updates.displayName || updates.commune || updates.region) {
        await updateDoc(doc(db, 'userPublicProfiles', firebaseUser.uid), {
          ...(updates.displayName ? {displayName: updates.displayName} : {}),
          ...(updates.commune ? {commune: updates.commune} : {}),
          ...(updates.region ? {region: updates.region} : {}),
          updatedAt: serverTimestamp(),
        });
      }
      setUserAccount((prev) => (prev ? {...prev, ...updates} : prev));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${firebaseUser.uid}`);
    }
  };

  const refreshAccount = async () => {
    if (auth.currentUser) {
      await auth.currentUser.reload();
      setFirebaseUser({...auth.currentUser});
      await syncUserDocument(auth.currentUser);
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUserAccount(null);
  };

  const isAdmin = Boolean(
    firebaseUser?.emailVerified &&
      (firebaseUser.email?.toLowerCase() === ADMIN_BOOTSTRAP_EMAIL.toLowerCase() ||
        userAccount?.roles.includes('admin') ||
        userAccount?.roles.includes('moderator'))
  );

  const needsEmailVerification = Boolean(firebaseUser && !firebaseUser.emailVerified);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        userAccount,
        authReady,
        isAdmin,
        needsEmailVerification,
        signInWithGoogle,
        signInWithEmail,
        registerWithEmail,
        sendPasswordReset,
        resendVerification,
        updateAccountProfile,
        refreshAccount,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
