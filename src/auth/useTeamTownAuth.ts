import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "../supabaseClient";

export type TeamMembership = {
  team_id: string;
  team_name: string;
  team_slug: string;
  display_name: string;
  member_role: "admin" | "rep";
  team_brand: Record<string, unknown>;
};

export function useTeamTownAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [membership, setMembership] = useState<TeamMembership | null>(null);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);
  const [authError, setAuthError] = useState("");
  const [isAccessDenied, setIsAccessDenied] = useState(false);
  const loadedUserIdRef = useRef<string | null>(null);

  async function loadMembership(nextSession: Session | null) {
    setSession(nextSession);
    setIsAccessDenied(false);

    if (!nextSession || !supabase) {
      loadedUserIdRef.current = null;
      setMembership(null);
      setIsLoading(false);
      return;
    }

    loadedUserIdRef.current = nextSession.user.id;
    setMembership(null);

    const { data, error } = await supabase.rpc("claim_team_membership");

    if (error) {
      setIsAccessDenied(false);
      setAuthError(error.message);
      setIsLoading(false);
      return;
    }

    const [claimedMembership] = (data ?? []) as TeamMembership[];

    if (!claimedMembership) {
      setIsAccessDenied(true);
      setAuthError("Your Google account is not enabled for this TeamTree workspace yet.");
      setIsLoading(false);
      return;
    }

    setAuthError("");
    setIsAccessDenied(false);
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

      const nextUserId = nextSession?.user?.id ?? null;
      if (nextUserId && nextUserId === loadedUserIdRef.current) {
        setSession(nextSession);
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
      setIsAccessDenied(false);
      setAuthError("Add Supabase env vars before using Google login.");
      return;
    }

    if (!isAccessDenied) {
      setAuthError("");
      setIsAccessDenied(false);
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        queryParams: {
          prompt: "select_account",
        },
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      setIsAccessDenied(false);
      setAuthError(error.message);
    }
  }

  async function signOut() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    loadedUserIdRef.current = null;
    setSession(null);
    setMembership(null);
    setIsAccessDenied(false);
  }

  return {
    authError,
    isAccessDenied,
    isConfigured: isSupabaseConfigured,
    isLoading,
    membership,
    session,
    signInWithGoogle,
    signOut,
  };
}
