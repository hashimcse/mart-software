const STYLES: Record<string, string> = {
  ACTIVE: 'bg-ledger-50 text-ledger-700',
  INACTIVE: 'bg-brass-50 text-brass-600',
  DISCONTINUED: 'bg-brick-50 text-brick-600',
  ORDERED: 'bg-brass-50 text-brass-600',
  RECEIVED: 'bg-ledger-50 text-ledger-700',
  INVOICED: 'bg-ink/5 text-ink/60',
  PAID: 'bg-ledger-50 text-ledger-700',
  CANCELLED: 'bg-brick-50 text-brick-600',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[status] ?? 'bg-ink/5 text-ink/60'}`}>
      {status}
    </span>
  );
}
