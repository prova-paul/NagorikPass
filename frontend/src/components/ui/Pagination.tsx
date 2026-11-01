import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from './Button'

function pageItems(page: number, pageCount: number): (number | 'gap')[] {
  const pages = [...new Set([1, page - 1, page, page + 1, pageCount])]
    .filter((value) => value >= 1 && value <= pageCount)
    .sort((a, b) => a - b)
  return pages.flatMap((value, index) => (index > 0 && value - pages[index - 1] > 1 ? ['gap' as const, value] : [value]))
}

export function Pagination({
  page,
  pageCount,
  pageSize,
  total,
  onChange,
}: {
  page: number
  pageCount: number
  pageSize: number
  total: number
  onChange: (page: number) => void
}) {
  if (total === 0) return null
  const first = (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
      <p className="text-sm text-muted tabular-nums">
        Showing {first}–{last} of {total}
      </p>
      {pageCount > 1 && (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="px-2" disabled={page === 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
            <ChevronLeft aria-hidden className="size-4" />
            <span className="hidden sm:inline">Previous</span>
          </Button>
          <ul className="hidden items-center gap-1 sm:flex">
            {pageItems(page, pageCount).map((item, index) =>
              item === 'gap' ? (
                <li key={`gap-${index}`} className="px-1 text-sm text-muted">
                  …
                </li>
              ) : (
                <li key={item}>
                  <button
                    type="button"
                    aria-current={item === page ? 'page' : undefined}
                    aria-label={`Page ${item}`}
                    onClick={() => onChange(item)}
                    className={`size-9 rounded-control text-sm tabular-nums transition-colors ${
                      item === page ? 'bg-primary-100 font-semibold text-primary-700' : 'text-muted hover:bg-neutral-100'
                    }`}
                  >
                    {item}
                  </button>
                </li>
              ),
            )}
          </ul>
          <span className="px-1 text-sm text-muted tabular-nums sm:hidden">
            {page} / {pageCount}
          </span>
          <Button variant="ghost" size="sm" className="px-2" disabled={page === pageCount} onClick={() => onChange(page + 1)} aria-label="Next page">
            <span className="hidden sm:inline">Next</span>
            <ChevronRight aria-hidden className="size-4" />
          </Button>
        </div>
      )}
    </nav>
  )
}
