import { SignUp } from "@clerk/nextjs";
import Link from 'next/link';

export default function SignUpPage() {
  return (
    <div className="auth-page">
      <Link href="/" className="brand">scout<span className="brand-dot">.</span></Link>
      <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
      <p className="auth-page-note">One account for your shortlist. Marketplace accounts are connected separately, on your terms.</p>
    </div>
  );
}
