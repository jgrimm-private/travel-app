import DisconnectDropboxButton from "@/components/DisconnectDropboxButton";
import ScanForTripsButton from "@/components/ScanForTripsButton";
import { connectionStatus } from "@/lib/dropbox-auth";

export const dynamic = "force-dynamic";

const BANNERS: Record<string, { cls: string; text: string }> = {
  connected: {
    cls: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
    text: "✅ Dropbox connected! Your trip photos will now show up automatically.",
  },
  denied: {
    cls: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
    text: "Connection cancelled — you declined access on Dropbox's page.",
  },
  error: {
    cls: "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200",
    text: "Something went wrong connecting to Dropbox. Please try again.",
  },
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ dropbox?: string }>;
}) {
  const status = connectionStatus();
  const banner = BANNERS[(await searchParams).dropbox ?? ""];

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold mb-6">Settings</h1>

      {banner && (
        <div className={`mb-6 rounded-lg border px-4 py-3 text-sm ${banner.cls}`}>
          {banner.text}
        </div>
      )}

      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
        <h2 className="font-semibold mb-1">Dropbox</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
          Connect once and each trip page automatically shows the photos you took during
          that trip, matched by date and location.
        </p>

        {status.connected && status.source === "oauth" ? (
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm">
              <p className="font-medium">
                Connected{status.account_name ? ` as ${status.account_name}` : ""}
              </p>
              <p className="text-zinc-500 dark:text-zinc-400">
                {status.account_email ?? "Dropbox account"}
                {status.connected_at ? ` · since ${status.connected_at.slice(0, 10)}` : ""}
              </p>
            </div>
            <DisconnectDropboxButton />
          </div>
        ) : status.connected && status.source === "env" ? (
          <div className="text-sm space-y-3">
            <p>
              Using a static <code className="font-mono text-xs">DROPBOX_ACCESS_TOKEN</code> from{" "}
              <code className="font-mono text-xs">.env.local</code>. These tokens expire after a
              few hours — connect with the button below for a permanent connection, then remove
              the env token.
            </p>
            <ConnectButton disabled={!status.app_key_configured} />
          </div>
        ) : (
          <div className="text-sm space-y-3">
            <p className="text-zinc-600 dark:text-zinc-300">Not connected.</p>
            <ConnectButton disabled={!status.app_key_configured} />
          </div>
        )}

        {status.connected && (
          <div className="mt-5 border-t border-zinc-200 dark:border-zinc-800 pt-5">
            <h3 className="font-medium mb-1">Discover trips automatically</h3>
            <ScanForTripsButton />
          </div>
        )}

        {!status.app_key_configured && (
          <div className="mt-4 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-4 text-sm text-zinc-500 dark:text-zinc-400">
            <p className="font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              One-time setup needed first
            </p>
            <ol className="list-decimal ml-4 space-y-1">
              <li>
                Create an app at{" "}
                <a
                  href="https://www.dropbox.com/developers/apps"
                  className="underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  dropbox.com/developers/apps
                </a>{" "}
                (Scoped access → Full Dropbox).
              </li>
              <li>
                Permissions tab: enable{" "}
                <code className="font-mono text-xs">files.metadata.read</code> and{" "}
                <code className="font-mono text-xs">files.content.read</code>.
              </li>
              <li>
                Settings tab: add <code className="font-mono text-xs">http://localhost:3000/api/dropbox/callback</code>{" "}
                as an OAuth 2 redirect URI.
              </li>
              <li>
                Put <code className="font-mono text-xs">DROPBOX_APP_KEY=your_app_key</code> in{" "}
                <code className="font-mono text-xs">.env.local</code> and restart the server.
              </li>
            </ol>
          </div>
        )}
      </section>
    </div>
  );
}

function ConnectButton({ disabled }: { disabled: boolean }) {
  if (disabled) {
    return (
      <span className="inline-block rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-400 px-4 py-2 text-sm font-medium cursor-not-allowed">
        Connect Dropbox
      </span>
    );
  }
  return (
    <a
      href="/api/dropbox/connect"
      className="inline-block rounded-lg bg-[#0061FF] text-white px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
    >
      Connect Dropbox
    </a>
  );
}
