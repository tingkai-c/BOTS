import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

export default function SignInPage() {
  return (
    <div className="auth-page">
      <Link href="/" className="brand">
        haggleface<span className="brand-dot">.</span>
      </Link>
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
      <p className="auth-page-note">
        Sign in to keep your searches, connect your marketplaces, and approve
        your offers.
      </p>
    </div>
  );
}
