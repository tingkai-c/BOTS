'use client';

import { createContext, useContext } from 'react';
import { ClerkProvider, useAuth, useUser, useClerk } from '@clerk/nextjs';
import { shadcn } from '@clerk/ui/themes';
import { ConvexReactClient } from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';

const convex = process.env.NEXT_PUBLIC_CONVEX_URL ? new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL) : null;
const ShoppingAuth = createContext({ required: false, loaded: true, signedIn: false, openSignIn: () => {} });
export const useShoppingAuth = () => useContext(ShoppingAuth);

function AccountContext({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useUser();
  const clerk = useClerk();
  return <ShoppingAuth.Provider value={{ required: true, loaded: isLoaded, signedIn: Boolean(isSignedIn), openSignIn: () => { void clerk.openSignIn(); } }}>{children}</ShoppingAuth.Provider>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return children;
  return <ClerkProvider telemetry={{ disabled: true }} signInUrl="/sign-in" signUpUrl="/sign-up" signInFallbackRedirectUrl="/" signUpFallbackRedirectUrl="/" appearance={{ theme: shadcn, variables: { colorPrimary: '#315c40', colorBackground: '#fafaf8', borderRadius: '0.5rem' } }}>
    <AccountContext>{convex ? <ConvexProviderWithClerk client={convex} useAuth={useAuth}>{children}</ConvexProviderWithClerk> : children}</AccountContext>
  </ClerkProvider>;
}
