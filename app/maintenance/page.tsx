import Link from "next/link";
import { BrandLockup } from "@/components/layout/brand-lockup";

export default function MaintenancePage() {
  return <main className="auth-shell">
    <section className="auth-card text-center" aria-labelledby="maintenance-title">
      <BrandLockup />
      <p className="page-kicker mt-8">Scheduled maintenance</p>
      <h1 id="maintenance-title" className="page-title mt-2">The arena is getting an upgrade.</h1>
      <p className="muted mt-4">Competition data remains safe. Please check back shortly while platform operations complete their work.</p>
      <div className="mt-6 flex justify-center gap-3">
        <Link className="button button-secondary" href="/">Back home</Link>
        <Link className="button button-primary" href="/tournaments/history">Tournament history</Link>
      </div>
    </section>
  </main>;
}
