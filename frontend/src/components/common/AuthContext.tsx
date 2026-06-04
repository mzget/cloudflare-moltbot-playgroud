import * as React from 'react';

export interface User {
  email: string;
  name: string;
  picture: string;
}

export interface AuthContextType {
  user: User | null;
  logout: () => void;
}

export const AuthContext = React.createContext<AuthContextType>({
  user: null,
  logout: () => {},
});
