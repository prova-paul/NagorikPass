'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Pagination } from '@/components/ui/Pagination'

/** The shared pagination bar, driven by the page's address so a page can be bookmarked or shared. */
export function ListPagination({ page, pageCount, pageSize, total }: { page: number; pageCount: number; pageSize: number; total: number }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  return (
    <Pagination
      page={page}
      pageCount={pageCount}
      pageSize={pageSize}
      total={total}
      onChange={(next) => {
        const query = new URLSearchParams(params.toString())
        if (next <= 1) query.delete('page')
        else query.set('page', String(next))
        const text = query.toString()
        router.push(text ? `${pathname}?${text}` : pathname)
      }}
    />
  )
}
