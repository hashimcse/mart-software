interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onChange }: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <div className="figure flex items-center justify-between border-t border-ink/10 px-4 py-3 text-sm">
      <span className="text-ink/50">
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2 font-sans">
        <button
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="rounded-md border border-ink/15 px-3 py-1.5 font-medium text-ink/70 hover:bg-paper disabled:opacity-40"
        >
          Previous
        </button>
        <button
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          className="rounded-md border border-ink/15 px-3 py-1.5 font-medium text-ink/70 hover:bg-paper disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
