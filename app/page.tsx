import { redirect } from 'next/navigation';

// The workspace is the app's home. Signed-out visitors are sent on to /login by proxy.ts.
export default function Home() {
  redirect('/workspace');
}
