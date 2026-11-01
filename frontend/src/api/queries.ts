import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  AdminStats,
  AppSettings,
  EmployeeStats,
  CalendarMonth,
  EmailStatus,
  Employee,
  HostSummary,
  Page,
  ReceptionStats,
  ReportSummary,
  StaffAccount,
  Visit,
  VisitDetail,
  VisitStatus,
  VisitType,
} from '../types'
import { api } from './client'

// Approvals arrive by email link, so lists a receptionist is watching need to refresh on their own.
export const LIVE_REFRESH_MS = 15_000

export interface VisitFilters {
  search?: string
  status?: VisitStatus[]
  type?: VisitType
  from?: string
  to?: string
  period?: 'today' | 'upcoming'
  /** For employees: visits they requested, or visits where they are a host. The API returns both when left out. */
  scope?: 'requested' | 'hosting'
}

export interface VisitQuery extends VisitFilters {
  sort?: string
  order?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export function visitParams({ status, ...rest }: VisitFilters & Partial<VisitQuery>) {
  return { ...rest, status: status?.join(',') }
}

export function useVisitList(query: VisitQuery, options: { live?: boolean } = {}) {
  return useQuery({
    queryKey: ['visits', query],
    queryFn: () => api.get<Page<Visit>>('/visits', visitParams(query)),
    placeholderData: keepPreviousData,
    refetchInterval: options.live ? LIVE_REFRESH_MS : false,
  })
}

/** Number of matching visits, for tab labels. */
export function useVisitCount(filters: VisitFilters, options: { live?: boolean } = {}) {
  const { data } = useVisitList({ ...filters, pageSize: 1 }, options)
  return data?.total
}

/** Steps back when the current page no longer exists, such as after its last row was removed. */
export function useClampPage(page: number, setPage: (page: number) => void, data: { total: number; pageSize: number } | undefined, isPlaceholder: boolean) {
  if (!data || isPlaceholder) return
  const pageCount = Math.max(1, Math.ceil(data.total / data.pageSize))
  if (page > pageCount) setPage(pageCount)
}

export function useVisitDetail(id: string) {
  return useQuery({
    queryKey: ['visits', 'detail', id],
    queryFn: async () => (await api.get<{ visit: VisitDetail }>(`/visits/${id}`)).visit,
  })
}

export function useStats<Stats extends AdminStats | ReceptionStats | EmployeeStats>() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: async () => (await api.get<{ stats: Stats }>('/dashboard/stats')).stats,
    refetchInterval: LIVE_REFRESH_MS,
  })
}

export function useHosts(search: string) {
  return useQuery({
    queryKey: ['hosts', search],
    queryFn: async () => (await api.get<{ items: HostSummary[] }>('/hosts', { search })).items,
    placeholderData: keepPreviousData,
  })
}

export interface EmployeeQuery {
  search?: string
  department?: string
  status?: string
  sort: string
  order: 'asc' | 'desc'
  page: number
  pageSize: number
}

export function useEmployeeList(query: EmployeeQuery) {
  return useQuery({
    queryKey: ['employees', query],
    queryFn: () => api.get<Page<Employee>>('/employees', { ...query }),
    placeholderData: keepPreviousData,
  })
}

export function useDepartments() {
  return useQuery({
    queryKey: ['employees', 'departments'],
    queryFn: async () => (await api.get<{ items: string[] }>('/employees/departments')).items,
  })
}

export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: async () => (await api.get<{ items: StaffAccount[] }>('/users')).items,
  })
}

export function useAvailableEmployees() {
  return useQuery({
    queryKey: ['accounts', 'available-employees'],
    queryFn: async () => (await api.get<{ items: (HostSummary & { officialEmail: string })[] }>('/users/available-employees')).items,
  })
}

export function useSettingsQuery() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await api.get<{ settings: AppSettings }>('/settings')).settings,
  })
}

export function useEmailStatus() {
  return useQuery({
    queryKey: ['settings', 'email-status'],
    queryFn: () => api.get<EmailStatus>('/settings/email-status'),
  })
}

export interface ReportParams {
  days?: number
  from?: string
  to?: string
  status?: string
  type?: string
}

export function useReport(params: ReportParams, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['report', params],
    queryFn: () => api.get<ReportSummary>('/reports/summary', { ...params }),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  })
}

/** One month of activity. Null means the current month, as the server's clock sees it. */
export function useCalendar(month: string | null) {
  return useQuery({
    queryKey: ['calendar', month],
    queryFn: () => api.get<CalendarMonth>('/reports/calendar', { month }),
    placeholderData: keepPreviousData,
    refetchInterval: LIVE_REFRESH_MS,
  })
}

/**
 * A write. Afterwards everything cached is refetched, so every page shows the new state. That
 * includes a refusal, which usually means this page was out of date. The refetch isn't awaited:
 * it can remove the row that started the write, and React Query drops a mutate() callback if its
 * component has already unmounted.
 */
export function useApiMutation<Input, Output>(mutationFn: (input: Input) => Promise<Output>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSettled: () => {
      void queryClient.invalidateQueries()
    },
  })
}
