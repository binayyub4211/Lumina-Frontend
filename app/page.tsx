import { AlertFeed } from "../src/components/dashboard/AlertFeed";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">
          Lumina Network — Live Event Monitor
        </h1>
        <AlertFeed />
      </div>
    </main>
  );
}