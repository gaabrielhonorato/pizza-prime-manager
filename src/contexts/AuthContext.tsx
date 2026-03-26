import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export type Perfil = "gestor" | "pizzaria" | "entregador" | "consumidor";

export interface UsuarioData {
  id: string;
  nome: string;
  email: string;
  cpf: string | null;
  telefone: string | null;
  perfil: Perfil;
  ativo: boolean;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  usuario: UsuarioData | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null; perfil?: Perfil }>;
  signInWithCpf: (cpf: string, password: string) => Promise<{ error: string | null; perfil?: Perfil }>;
  signUp: (data: {
    email: string;
    password: string;
    nome: string;
    cpf?: string;
    telefone?: string;
    perfil?: Perfil;
  }) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [usuario, setUsuario] = useState<UsuarioData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUsuario = async (userId: string) => {
    const { data } = await supabase
      .from("usuarios")
      .select("*")
      .eq("id", userId)
      .single();
    if (data) {
      setUsuario(data as UsuarioData);
      // Update last access
      await supabase.from("usuarios").update({ ultimo_acesso: new Date().toISOString() }).eq("id", userId);
    }
    return data as UsuarioData | null;
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        // Use setTimeout to avoid Supabase client deadlock
        setTimeout(() => fetchUsuario(session.user.id), 0);
      } else {
        setUsuario(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUsuario(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { error: error.message };
    }
    if (data.user) {
      const usr = await fetchUsuario(data.user.id);
      if (usr && !usr.ativo) {
        await supabase.auth.signOut();
        return { error: "Sua conta está inativa. Entre em contato com o suporte." };
      }
      return { error: null, perfil: usr?.perfil };
    }
    return { error: "Erro desconhecido" };
  };

  const signInWithCpf = async (cpf: string, password: string) => {
    // Look up email by CPF using a public function or direct query
    const { data: usr } = await supabase
      .from("usuarios")
      .select("email")
      .eq("cpf", cpf)
      .single();
    
    if (!usr) {
      return { error: "E-mail/CPF ou senha incorretos. Tente novamente." };
    }
    return signIn(usr.email, password);
  };

  const signUp = async (data: {
    email: string;
    password: string;
    nome: string;
    cpf?: string;
    telefone?: string;
    perfil?: Perfil;
  }) => {
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          nome: data.nome,
          cpf: data.cpf || null,
          telefone: data.telefone || null,
          perfil: data.perfil || "consumidor",
        },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setUsuario(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, usuario, loading, signIn, signInWithCpf, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
