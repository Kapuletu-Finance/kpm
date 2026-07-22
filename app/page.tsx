'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/store/AuthContext";

export default function Home() {
  const router = useRouter();
  const { isLoading } = useAuth();
  const [targetRoute, setTargetRoute] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash;
    // Intercept stranded Supabase hashes and determine the correct destination
    if (hash && hash.includes('type=invite')) {
      setTargetRoute('/accept-invite');
    } else if (hash && hash.includes('type=recovery')) {
      setTargetRoute('/reset-password');
    } else {
      setTargetRoute('/workspace');
    }
  }, []);

  useEffect(() => {
    // Wait for Supabase to finish parsing the hash and establishing the session
    // before we navigate away, preventing 'AuthSessionMissingError' and token corruption.
    if (targetRoute && !isLoading) {
      router.replace(targetRoute);
    }
  }, [targetRoute, isLoading, router]);

  return null;
}
