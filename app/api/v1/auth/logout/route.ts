import { NextResponse } from 'next/server';
import { signOut } from '@/auth';

export async function POST() {
  try {
    await signOut({ redirect: false });
    return NextResponse.json({ message: 'Logout successful' });
  } catch (err) {
    console.error('Logout exception:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
