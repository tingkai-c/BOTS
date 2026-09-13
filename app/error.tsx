'use client';
import { Button } from '@/components/ui/button';
export default function ErrorPage({ reset }: { reset: () => void }) { return <main className="workspace-page" role="alert"><h1>This page could not load</h1><p>Your saved work is still there. Check your connection and try again.</p><Button onClick={reset}>Try again</Button></main>; }
