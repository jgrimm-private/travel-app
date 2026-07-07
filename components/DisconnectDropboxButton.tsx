"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DisconnectDropboxButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDisconnect() {
    if (!confirm("Disconnect Dropbox? Trip photos will stop showing until you reconnect.")) return;
    setBusy(true);
    await fetch("/api/dropbox/disconnect", { method: "POST" });
    router.refresh();
    setBusy(false);
  }

  return (
    <button
      type="button"
      onClick={handleDisconnect}
      disabled={busy}
      className="shrink-0 rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
    >
      {busy ? "Disconnecting…" : "Disconnect"}
    </button>
  );
}
