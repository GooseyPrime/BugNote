import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

type AuthContextValue = {
  credential: string | null;
  setCredential: (credential: string | null) => void;
  clearCredential: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [credential, setCredential] = useState<string | null>(null);
  const clearCredential = useCallback(() => setCredential(null), []);
  return (
    <AuthContext.Provider value={{ credential, setCredential, clearCredential }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthCredential(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthCredential must be used within AuthProvider");
  }
  return ctx;
}
