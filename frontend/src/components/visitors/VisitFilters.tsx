import { FilterBar, FilterSelect } from '@/components/employees/FilterBar'
import { compactLabelClass, controlClass } from '@/components/ui/controlStyles'
import { ANY, type VisitParams } from '@/lib/visitQueries'
import { CATEGORIES, SOURCE_LABEL, SOURCE_VALUES, STATUS, STATUS_VALUES } from '@/lib/visitLabels'

export function isFiltered(params: VisitParams, defaults: { status?: string } = {}) {
  return params.search !== '' || params.status !== (defaults.status ?? ANY) || params.category !== ANY || params.source !== ANY || params.from !== '' || params.to !== ''
}

function DateField({ name, label, value }: { name: string; label: string; value: string }) {
  return (
    <div>
      <label htmlFor={`filter-${name}`} className={compactLabelClass}>
        {label}
      </label>
      <input id={`filter-${name}`} type="date" name={name} defaultValue={value} className={controlClass({ compact: true })} />
    </div>
  )
}

/** Search and filters for every visit list, as a plain GET form so the view lives in the address. */
export function VisitFilters({ action, params, defaults, showSource = true }: { action: string; params: VisitParams; defaults?: { status?: string }; showSource?: boolean }) {
  return (
    <FilterBar action={action} search={params.search} searchLabel="Search name, phone, ID, host or card" active={isFiltered(params, defaults)}>
      <FilterSelect name="status" label="Status" value={params.status} options={[{ value: ANY, label: 'All' }, ...STATUS_VALUES.map((value) => ({ value, label: STATUS[value].label }))]} />
      <FilterSelect name="category" label="Visitor type" value={params.category} options={[{ value: ANY, label: 'All types' }, ...CATEGORIES.map((category) => ({ value: category.value, label: category.label }))]} />
      {showSource && <FilterSelect name="source" label="Registered by" value={params.source} options={[{ value: ANY, label: 'Anyone' }, ...SOURCE_VALUES.map((value) => ({ value, label: SOURCE_LABEL[value] }))]} />}
      <DateField name="from" label="From" value={params.from} />
      <DateField name="to" label="To" value={params.to} />
    </FilterBar>
  )
}
