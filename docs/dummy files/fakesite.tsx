import { Mountain, CheckCircle2, ShieldCheck, Star } from "lucide-react";
import type { PageId } from "@/lib/agentContext";

export type RegFn = (id: string) => (el: HTMLElement | null) => void;

interface Props { page: PageId; inputs: Record<string, string>; reg: RegFn; }

export function FakeSite({ page, inputs, reg }: Props) {
  if (page === "blank") return <div className="h-full bg-white" />;
  if (page === "loading")
    return (
      <div className="relative h-full overflow-hidden bg-white">
        <div className="absolute left-0 top-0 h-0.5 w-1/4 rounded-full bg-blue-500 animate-loadbar" />
      </div>
    );
  return (
    <div className="h-full overflow-y-auto bg-[#F6F7F9] text-slate-800">
      <SiteNav reg={reg} signedIn={page !== "home"} />
      {page === "home" && <HomePage reg={reg} />}
      {page === "login" && <LoginPage reg={reg} inputs={inputs} />}
      {page === "checkout" && <CheckoutPage reg={reg} />}
      {page === "confirm" && <ConfirmPage />}
    </div>
  );
}

function SiteNav({ reg, signedIn }: { reg: RegFn; signedIn: boolean }) {
  return (
    <div className="flex items-center gap-6 border-b border-slate-200 bg-white px-6 py-3">
      <span className="flex items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded-md bg-blue-600 text-white"><Mountain className="size-3.5" /></span>
        <span className="text-sm font-bold tracking-tight">Blixen Tours</span>
      </span>
      <span className="flex gap-4 text-xs font-medium text-slate-500">
        <span className="cursor-pointer hover:text-slate-900">Tours</span>
        <span className="cursor-pointer hover:text-slate-900">About</span>
        <span className="cursor-pointer hover:text-slate-900">Journal</span>
      </span>
      <span className="flex-1" />
      {signedIn ? (
        <span className="flex items-center gap-2 rounded-full bg-slate-100 py-1 pl-1 pr-3 text-[11px] font-medium text-slate-600">
          <span className="flex size-5 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white">D</span>
          demo@blixen.tours
        </span>
      ) : (
        <button ref={reg("nav-signin")} className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white">
          Sign in
        </button>
      )}
    </div>
  );
}

function HomePage({ reg }: { reg: RegFn }) {
  const tours = [
    { name: "Lofoten Night Sky", meta: "5 nights · Norway", price: "€348", tone: "from-indigo-500 to-slate-900" },
    { name: "Geiranger Fjords", meta: "3 nights · Norway", price: "€219", tone: "from-teal-500 to-slate-900" },
    { name: "Aurora Highlands", meta: "7 nights · Iceland", price: "€512", tone: "from-violet-500 to-slate-900" },
  ];
  return (
    <div>
      <div className="bg-gradient-to-b from-[#0E1A2B] to-[#1B2B44] px-6 pb-14 pt-14 text-white">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-cyan-300">Guided nordic expeditions</p>
        <h1 className="max-w-lg text-4xl font-bold leading-tight tracking-tight">Nordic light, guided.</h1>
        <p className="mt-2 max-w-md text-sm text-slate-300">Small-group tours across Norway and Iceland, led by people who grew up under the aurora.</p>
        <div className="mt-6 flex max-w-md items-center gap-2 rounded-xl bg-white p-1.5 shadow-xl shadow-black/30">
          <input ref={reg("home-search")} readOnly placeholder="Where to? Try “Lofoten”…" className="flex-1 bg-transparent px-3 text-xs text-slate-800 outline-none" />
          <button ref={reg("home-go")} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white">Search</button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 px-6 py-8">
        {tours.map((t) => (
          <div key={t.name} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className={`flex h-28 items-end bg-gradient-to-br p-3 ${t.tone}`}>
              <Mountain className="size-5 text-white/70" />
            </div>
            <div className="p-3">
              <p className="text-xs font-bold">{t.name}</p>
              <p className="mt-0.5 text-[10px] text-slate-500">{t.meta}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">{t.price}</span>
                <span className="flex items-center gap-1 text-[10px] text-amber-500"><Star className="size-3 fill-amber-400 text-amber-400" />4.9</span>
              </div>
              <button className="mt-2.5 w-full rounded-lg border border-slate-200 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50">Book</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoginPage({ reg, inputs }: { reg: RegFn; inputs: Record<string, string> }) {
  return (
    <div className="mx-auto max-w-sm px-6 py-14">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold tracking-tight">Welcome back</h2>
        <p className="mb-5 mt-1 text-xs text-slate-500">Sign in to manage your bookings.</p>
        <label className="mb-1 block text-[11px] font-semibold text-slate-600">Email</label>
        <input
          ref={reg("login-email")}
          readOnly
          value={inputs["login-email"] ?? ""}
          placeholder="you@example.com"
          className="mb-4 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs outline-none focus:border-blue-500"
        />
        <label className="mb-1 block text-[11px] font-semibold text-slate-600">Password</label>
        <input
          ref={reg("login-password")}
          readOnly
          value={inputs["login-password"] ?? ""}
          placeholder="••••••••"
          className="mb-5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs outline-none focus:border-blue-500"
        />
        <button ref={reg("login-submit")} className="w-full rounded-lg bg-slate-900 py-2.5 text-xs font-semibold text-white">
          Sign in
        </button>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[10px] text-slate-400">
          <ShieldCheck className="size-3" /> Demo workspace — credentials injected from vault
        </p>
      </div>
    </div>
  );
}

function CheckoutPage({ reg }: { reg: RegFn }) {
  return (
    <div className="mx-auto grid max-w-3xl grid-cols-2 gap-5 px-6 py-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-bold">Order summary</h3>
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="flex size-12 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-slate-900">
            <Mountain className="size-5 text-white/80" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold">Lofoten Night Sky</p>
            <p className="text-[10px] text-slate-500">5 nights · 2 travellers · Mar 14</p>
          </div>
          <span className="text-xs font-bold">€348.00</span>
        </div>
        <div className="mt-4 space-y-1.5 text-[11px] text-slate-500">
          <p className="flex justify-between"><span>Subtotal</span><span>€348.00</span></p>
          <p className="flex justify-between"><span>Flexible cancellation</span><span>Included</span></p>
          <p className="flex justify-between border-t border-slate-100 pt-2 text-xs font-bold text-slate-900"><span>Total</span><span>€348.00</span></p>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-bold">Payment</h3>
        <label className="mb-1 block text-[11px] font-semibold text-slate-600">Card number</label>
        <input readOnly value="4242 4242 4242 4242" className="mb-3 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-500 outline-none" />
        <div className="mb-5 grid grid-cols-2 gap-3">
          <input readOnly value="12 / 28" className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-500 outline-none" />
          <input readOnly value="•••" className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-500 outline-none" />
        </div>
        <button ref={reg("pay-submit")} className="w-full rounded-lg bg-blue-600 py-2.5 text-xs font-semibold text-white shadow-lg shadow-blue-600/25">
          Pay €348.00
        </button>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-slate-400">
          <ShieldCheck className="size-3" /> 256-bit TLS · PCI-DSS
        </p>
      </div>
    </div>
  );
}

function ConfirmPage() {
  return (
    <div className="flex flex-col items-center px-6 py-20 text-center">
      <span className="mb-5 flex size-14 items-center justify-center rounded-full bg-emerald-100">
        <CheckCircle2 className="size-7 text-emerald-600" />
      </span>
      <h1 className="text-2xl font-bold tracking-tight">Booking confirmed</h1>
      <p className="mt-2 max-w-xs text-xs text-slate-500">Your expedition is locked in. A confirmation email is on its way to demo@blixen.tours.</p>
      <p className="mt-5 rounded-lg border border-slate-200 bg-white px-4 py-2 font-mono text-sm font-bold tracking-widest text-slate-900">BLX-90413</p>
      <div className="mt-6 flex gap-3">
        <button className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white">View booking</button>
        <button className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600">Back to home</button>
      </div>
    </div>
  );
}
