'use client';
import { ClerkProvider,useAuth } from '@clerk/nextjs';
import { ConvexReactClient } from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
const convex=process.env.NEXT_PUBLIC_CONVEX_URL?new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL):null;
export function Providers({children}:{children:React.ReactNode}){if(!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)return children;return <ClerkProvider>{convex?<ConvexProviderWithClerk client={convex} useAuth={useAuth}>{children}</ConvexProviderWithClerk>:children}</ClerkProvider>;}
