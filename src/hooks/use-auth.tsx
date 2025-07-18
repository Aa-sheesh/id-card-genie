"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, db, isConfigured } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export interface AuthUser {
  uid: string;
  email: string | null;
  photoURL: string | null;
  role: 'admin' | 'user';
  schoolId?: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isConfigured || !auth || !db) {
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
      if (firebaseUser) {
        // Fetch user's role and schoolId from their user document in Firestore
        const userDocRef = doc(db, "users", firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        let role: 'admin' | 'user' = 'user';
        let schoolId: string | null = null;

        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            role = userData.role || 'user';
            schoolId = userData.schoolId || null;
        } else {
            console.warn(`User with UID ${firebaseUser.uid} exists in Auth but not in Firestore. They will have default 'user' permissions.`);
        }

        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          photoURL: firebaseUser.photoURL,
          role: role, 
          schoolId: schoolId,
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
