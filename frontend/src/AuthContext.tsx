import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from './api';

export interface PetugasUser {
  role: 'petugas';
  petugas_id: number;
  nama: string;
  username: string;
  jabatan: string;
  wajib_ganti_password: boolean;
}

export type User = PetugasUser;

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
    const checkAuth = async () => {
      try {
        const petugasRes = await api.get('/api/me');
        setUser({ ...petugasRes.data.user, role: 'petugas' });
      } catch {
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
      await api.post('/api/logout');
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
