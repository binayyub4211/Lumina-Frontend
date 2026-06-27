import { OfflineBanner } from "@/src/components/shared/OfflineBanner";

export const dynamic = "force-static";
export const revalidate = false;

export const metadata = {
  title: "Lumina Network · Offline",
  description:
    "Lumina dashboard is unreachable right now. Cached sections may still be viewable.",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#f7f4ee] px-6 py-12 text-[#171512]">
      <div className="w-full max-w-xl rounded-lg border border-[#d8d0c1] bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#6f5f48]">
          Lumina Network
        </p>
        <h1 className="mt-3 text-3xl font-semibold">You&rsquo;re offline</h1>
        <p className="mt-4 text-base text-[#3e3830]">
          We could not reach the dashboard. Anything you do now (signing a
          transaction or reporting an error) will be queued locally and replayed
          the moment your facility reconnects.
        </p>
        <OfflineBanner />
        <ol className="mt-6 list-decimal space-y-2 pl-5 text-left text-sm text-[#3e3830]">
          <li>Verify the facility&rsquo;s uplink.</li>
          <li>Re-open this tab to replay pending actions.</li>
          <li>Contact your administrator if connectivity is restored but the dashboard still fails to load.</li>
        </ol>
      </div>
    </main>
  );
}
