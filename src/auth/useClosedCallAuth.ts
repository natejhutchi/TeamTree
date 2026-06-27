import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "../supabaseClient";

export type CompanyMembership = {
  company_id: string;
  company_name: string;
  company_slug: string;
  display_name: string;
  member_role: "owner" | "admin" | "editor" | "rep";
  company_brand: Record<string, unknown>;
};

export function useClosedCallAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [membership, setMembership] = useState<CompanyMembership | null>(null);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);
  const [authError, setAuthError] = useState("");

  async function loadMembership(nextSession: Session | null) {
    setSession(nextSession);
    setMembership(null);

    if (!nextSession || !supabase) {
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase.rpc("claim_company_membership");

    if (error) {
      setAuthError(error.message);
      setIsLoading(false);
      return;
    }

    const [claimedMembership] = (data ?? []) as CompanyMembership[];

    if (!claimedMembership) {
      setAuthError("Your Google account is not enabled for this ClosedCall workspace yet.");
      setIsLoading(false);
      return;
    }

    setAuthError("");
    setMembership(claimedMembership);
    setIsLoading(false);
  }

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) {
        return;
      }

      void loadMembership(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) {
        return;
      }

      setIsLoading(true);
      void loadMembership(nextSession);
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signInWithGoogle() {
    if (!supabase) {
      setAuthError("Add Supabase env vars before using Google login.");
      return;
    }

    setAuthError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      setAuthError(error.message);
    }
  }

  async function signOut() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    setSession(null);
    setMembership(null);
  }

  return {
    authError,
    isConfigured: isSupabaseConfigured,
    isLoading,
    membership,
    session,
    signInWithGoogle,
    signOut,
  };
}
