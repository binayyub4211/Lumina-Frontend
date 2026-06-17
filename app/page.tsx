import { AlertFeed } from "../src/components/dashboard/AlertFeed";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">
          Lumina Network — Live Event Monitor
        </h1>
        <AlertFeed />
    <main className="min-h-screen bg-[#f7f4ee] text-[#171512]">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-5 sm:px-8 lg:px-10">
        <header className="flex flex-col gap-4 border-b border-[#d8d0c1] pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#6f5f48]">
              Lumina Network
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-[#171512] sm:text-4xl">
              Vesting operations dashboard
            </h1>
          </div>
          <nav className="flex flex-wrap gap-2 text-sm font-medium text-[#3e3830]">
            {["Vaults", "Streams", "Governance", "Compliance"].map((item) => (
              <a
                className="rounded-md border border-[#cfc4b1] bg-white px-3 py-2 transition hover:border-[#0f766e] hover:text-[#0f766e]"
                href={`#${item.toLowerCase()}`}
                key={item}
              >
                {item}
              </a>
            ))}
            <a
              className="rounded-md border border-[#cfc4b1] bg-white px-3 py-2 transition hover:border-[#0f766e] hover:text-[#0f766e]"
              href="/pending-tx"
            >
              Pending
            </a>
          </nav>
        </header>

        <section className="grid flex-1 gap-6 py-8 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="flex flex-col gap-6">
            <section
              className="overflow-hidden rounded-lg border border-[#d8d0c1] bg-white"
              id="vaults"
            >
              <div className="flex flex-col gap-4 border-b border-[#ece5d8] p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Vesting vaults</h2>
                  <p className="mt-1 text-sm text-[#6f5f48]">
                    Track beneficiary unlocks, claim windows, and review states.
                  </p>
                </div>
                <button className="w-fit rounded-md bg-[#0f766e] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#115e59]">
                  New vault
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                  <thead className="bg-[#faf8f3] text-xs uppercase tracking-[0.12em] text-[#6f5f48]">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Beneficiary</th>
                      <th className="px-5 py-3 font-semibold">Asset</th>
                      <th className="px-5 py-3 font-semibold">Unlocked</th>
                      <th className="px-5 py-3 font-semibold">Next claim</th>
                      <th className="px-5 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vaults.map((vault) => (
                      <tr
                        className="border-t border-[#ece5d8]"
                        key={vault.beneficiary}
                      >
                        <td className="px-5 py-4 font-medium">
                          {vault.beneficiary}
                        </td>
                        <td className="px-5 py-4 text-[#6f5f48]">
                          {vault.asset}
                        </td>
                        <td className="px-5 py-4">
                          <div className="h-2 w-28 rounded-full bg-[#eadfce]">
                            <div
                              className="h-2 rounded-full bg-[#0f766e]"
                              style={{ width: vault.unlocked }}
                            />
                          </div>
                          <span className="mt-2 block text-xs text-[#6f5f48]">
                            {vault.unlocked}
                          </span>
                        </td>
                        <td className="px-5 py-4 font-medium">
                          {vault.nextClaim}
                        </td>
                        <td className="px-5 py-4">
                          <span className="rounded-md bg-[#eef7f2] px-2.5 py-1 text-xs font-semibold text-[#0f766e]">
                            {vault.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-3" id="streams">
              {streams.map((stream) => (
                <article
                  className="rounded-lg border border-[#d8d0c1] bg-white p-5"
                  key={stream.label}
                >
                  <p className="text-sm font-medium text-[#6f5f48]">
                    {stream.label}
                  </p>
                  <p className="mt-3 text-3xl font-semibold">{stream.value}</p>
                  <p className="mt-2 text-sm text-[#6f5f48]">{stream.detail}</p>
                </article>
              ))}
            </section>
          </div>

          <aside className="flex flex-col gap-6">
            <section
              className="rounded-lg border border-[#d8d0c1] bg-[#171512] p-5 text-white"
              id="governance"
            >
              <h2 className="text-xl font-semibold">Governance queue</h2>
              <div className="mt-5 flex flex-col gap-4">
                {proposals.map((proposal) => (
                  <article
                    className="rounded-md border border-white/15 bg-white/8 p-4"
                    key={proposal.title}
                  >
                    <h3 className="font-medium">{proposal.title}</h3>
                    <div className="mt-4 flex items-center justify-between text-sm text-[#f3d28b]">
                      <span>{proposal.votes}</span>
                      <span>Closes in {proposal.closes}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section
              className="rounded-lg border border-[#d8d0c1] bg-white p-5"
              id="compliance"
            >
              <h2 className="text-xl font-semibold">Compliance health</h2>
              <div className="mt-5 space-y-4">
                <div>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">KYC coverage</span>
                    <span className="text-[#0f766e]">96%</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-[#eadfce]">
                    <div className="h-2 w-[96%] rounded-full bg-[#0f766e]" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">AML checks</span>
                    <span className="text-[#9a3412]">4 flagged</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-[#eadfce]">
                    <div className="h-2 w-[78%] rounded-full bg-[#d97706]" />
                  </div>
                </div>
              </div>
              <button className="mt-6 w-full rounded-md border border-[#cfc4b1] px-4 py-2 text-sm font-semibold text-[#3e3830] transition hover:border-[#0f766e] hover:text-[#0f766e]">
                Review checkpoints
              </button>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}