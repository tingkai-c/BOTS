'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { History, Search, Settings, Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { UserButton, useUser } from '@clerk/nextjs';
import { Modal } from './ui/dialog';
import { Button } from './ui/button';
import { useShoppingAuth } from './providers';

function Account() {
  const { user } = useUser();
  return <div className="sidebar-account"><UserButton /><div><strong>{user?.fullName || user?.username || 'Your account'}</strong><small>{user?.primaryEmailAddress?.emailAddress}</small></div></div>;
}
export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const auth = useShoppingAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false);
  if (path.startsWith('/sign-')) return children;
  const navigation = <><Link className="sidebar-brand" href="/" onClick={() => setOpen(false)} aria-label="Haggleface home">{collapsed ? 'h.' : 'haggleface.'}</Link><nav aria-label="Main navigation">
    {[[Search, 'Search', '/'], [History, 'History', '/history']] .map(([Icon, label, href]) => {
      const Component = Icon as typeof Search; const url = href as string; const title = label as string;
      return <Link key={url} href={url} title={title} aria-label={title} aria-current={(url === '/' ? path === '/' || path.startsWith('/search/') : path === url) ? 'page' : undefined} onClick={() => setOpen(false)}><Component size={19}/><span>{title}</span></Link>;
    })}
  </nav><div className="sidebar-bottom"><Link href="/settings" title="Account settings" aria-label="Account settings" aria-current={path === '/settings' ? 'page' : undefined} onClick={() => setOpen(false)}><Settings size={19}/><span>Account settings</span></Link>
  {auth.required && auth.signedIn ? <Account/> : <Button variant="ghost" onClick={() => auth.required ? auth.openSignIn() : setOpen(false)}>{auth.required ? 'Sign in' : 'Demo workspace'}</Button>}</div></>;
  return <div className={`global-workspace ${collapsed ? 'sidebar-collapsed' : ''}`}><aside className="global-sidebar">{navigation}<button className="sidebar-toggle" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setCollapsed(!collapsed)}>{collapsed ? <PanelLeftOpen size={18}/> : <PanelLeftClose size={18}/>}</button></aside><div className="global-content"><button className="mobile-nav-button" aria-label="Open navigation" onClick={() => setOpen(true)}><Menu size={20}/> haggleface.</button>{children}</div><Modal open={open} onOpenChange={setOpen} title="Navigation"><div className="mobile-sidebar">{navigation}</div></Modal></div>;
}
