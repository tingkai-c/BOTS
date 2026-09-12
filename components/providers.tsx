'use client';
import { ClerkProvider,useAuth } from '@clerk/nextjs';
import { shadcn } from '@clerk/ui/themes';
import { ConvexReactClient } from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
const convex=process.env.NEXT_PUBLIC_CONVEX_URL?new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL):null;
export function Providers({children}:{children:React.ReactNode}){if(!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)return children;return <ClerkProvider telemetry={{disabled:true}} signInUrl="/sign-in" signUpUrl="/sign-up" signInFallbackRedirectUrl="/" signUpFallbackRedirectUrl="/" appearance={{theme:shadcn,variables:{colorPrimary:'#315c40',colorBackground:'#fafaf8',borderRadius:'0.5rem'}}}>{convex?<ConvexProviderWithClerk client={convex} useAuth={useAuth}>{children}</ConvexProviderWithClerk>:children}</ClerkProvider>;}
