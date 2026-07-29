import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from './api';

export interface PetugasUser {
  role: 'petugas';
  petugas_id: number;
  nama: string;
  username: string;
  jabatan: string;
}

export interface SantriUser {
  role: 'santri';
  santri_id: number;
  nama: string;
  nis: string;
  // you can add more if needed
}

export type User = PetugasUser | SantriUser;

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (user: User) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in on mount. We try both endpoints.
    const checkAuth = async () => {
      try {
        const petugasRes = await api.get('/api/me');
        setUser({ ...petugasRes.data.user, role: 'petugas' });
        setLoading(false);
        return;
      } catch (e) {
        // Not a petugas, try santri
      }

      try {
        const santriRes = await api.get('/api/santri/me');
        setUser({ ...santriRes.data.user, role: 'santri' });
      } catch (e) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = (userData: User) => {
    setUser(userData);
  };

  const logout = async () => {
    try {
      if (user?.role === 'santri') {
        await api.post('/api/santri/logout');
      } else {
        await api.post('/api/logout');
      }
    } catch (e) {
      console.error('Logout failed', e);
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
