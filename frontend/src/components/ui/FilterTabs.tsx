export interface FilterTab<Value extends string> {
  value: Value
  label: string
  count?: number
}

export function FilterTabs<Value extends string>({
  label,
  tabs,
  value,
  onChange,
}: {
  label: string
  tabs: FilterTab<Value>[]
  value: Value
  onChange: (value: Value) => void
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1 rounded-control bg-neutral-100 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          aria-pressed={tab.value === value}
          onClick={() => onChange(tab.value)}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors sm:flex-none ${
            tab.value === value ? 'bg-surface text-primary-700 shadow-card' : 'text-neutral-600 hover:text-ink'
          }`}
        >
          {tab.label}
          {tab.count !== undefined && <span className="ml-1.5 tabular-nums">{tab.count}</span>}
        </button>
      ))}
    </div>
  )
}
