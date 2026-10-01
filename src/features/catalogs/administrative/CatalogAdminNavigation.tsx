'use client'

import { Dropdown } from 'primereact/dropdown'
import { TabMenu } from 'primereact/tabmenu'
import { SECTION_ITEMS, type CatalogSection } from '@/features/catalogs/administrative/catalogAdminModel'

type Props = {
  section: CatalogSection
  onChange: (section: CatalogSection) => void
}

export function CatalogAdminNavigation({ section, onChange }: Props) {
  const activeSectionIndex = Math.max(0, SECTION_ITEMS.findIndex((item) => item.key === section))

  return (
    <div className="nx-catalog-navigation" aria-label="Tipos de cadastro">
      <TabMenu
        model={SECTION_ITEMS.map((item) => ({ label: item.label, icon: item.icon }))}
        activeIndex={activeSectionIndex}
        onTabChange={(event) => onChange(SECTION_ITEMS[event.index].key)}
        className="nx-catalog-tabmenu"
      />
      <Dropdown
        value={section}
        options={SECTION_ITEMS.map((item) => ({ label: item.label, value: item.key }))}
        onChange={(event) => onChange(event.value as CatalogSection)}
        className="nx-catalog-mobile-nav"
        aria-label="Tipo de cadastro"
      />
    </div>
  )
}
