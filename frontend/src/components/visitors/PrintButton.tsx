'use client'

import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export function PrintButton() {
  return (
    <Button onClick={() => window.print()} className="print:hidden">
      <Printer aria-hidden className="size-4" />
      Print or save as PDF
    </Button>
  )
}
