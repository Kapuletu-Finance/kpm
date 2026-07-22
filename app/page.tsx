'use client';

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;
    // Intercept stranded Supabase hashes before middleware bounces us to /login.
    // We use a SOFT navigation (router.replace) and preserve the hash so that 
    // Supabase's createBrowserClient (which mounts in AuthContext) can finish
    // its asynchronous token exchange without the browser aborting the network request.
    if (hash && hash.includes('type=invite')) {
      router.replace('/accept-invite' + hash);
    } else if (hash && hash.includes('type=recovery')) {
      router.replace('/reset-password' + hash);
    } else {
      router.replace('/workspace');
    }
  }, [router]);

  return null;
}
