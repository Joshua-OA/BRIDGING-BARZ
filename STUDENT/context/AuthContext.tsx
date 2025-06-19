import React, { createContext, useContext, useState, useEffect } from 'react';

type User = {
  id: string;
  name: string;
  avatar: string;
  campusId: string | null;
};

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  signIn: (userId: string, password: string) => Promise<void>;
  signUp: (password: string) => Promise<void>;
  signOut: () => void;
  isLoading: boolean;
  grantCampusAccess: (campusId: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  signIn: async () => {},
  signUp: async () => {},
  signOut: () => {},
  isLoading: false,
  grantCampusAccess: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    setUser(null);
  }, []);

  const signIn = async (userId: string, password: string) => {
    setIsLoading(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (userId === 'user123' && password === 'password') {
        setUser({
          id: 'user123',
          name: 'John Doe',
          avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
          campusId: null,
        });
      } else {
        throw new Error('Invalid credentials');
      }
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (password: string) => {
    setIsLoading(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const generatedUserId = 'user' + Math.random().toString(36).substr(2, 5);

      setUser({
        id: generatedUserId,
        name: 'New User',
        avatar: 'https://randomuser.me/api/portraits/men/68.jpg',
        campusId: null,
      });
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const grantCampusAccess = (campusId: string) => {
    if (user) {
      setUser({ ...user, campusId });
    }
  };

  const signOut = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        signIn,
        signUp,
        signOut,
        isLoading,
        grantCampusAccess,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
