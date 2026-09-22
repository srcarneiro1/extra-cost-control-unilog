import type {
  CatalogSection,
  GoalDraft,
  HolidayDraft,
  NamedDraft,
  ProductDraft,
  ProviderDraft,
} from '@/features/catalogs/administrative/catalogAdminModel'
import {
  competenceLabel,
  isNamedSection,
  isPriceSection,
  namedSectionLabel,
} from '@/features/catalogs/administrative/catalogAdminPresentation'

export function pageActionLabel(section: CatalogSection) {
  return section === 'OPERACOES' ? 'Nova operação'
    : section === 'SUPERVISORES' ? 'Novo supervisor'
      : section === 'FUNCOES' ? 'Nova função'
        : section === 'ATIVIDADES' ? 'Nova atividade'
          : section === 'FERIADOS' ? 'Novo feriado'
            : section === 'METAS' ? 'Nova meta'
              : section === 'FORNECEDORES' ? 'Novo fornecedor'
                : section === 'PRODUTOS' ? 'Novo produto'
                  : section === 'PRECOS_MO' ? 'Novo preço de mão de obra'
                    : 'Novo preço de produto'
}

export function modalEyebrow(section: CatalogSection, editing: boolean, reactivating: boolean) {
  if (isNamedSection(section)) return editing ? `EDIÇÃO DE ${namedSectionLabel(section).toUpperCase()}` : `NOV${section === 'FUNCOES' || section === 'ATIVIDADES' || section === 'OPERACOES' ? 'A' : 'O'} ${namedSectionLabel(section).toUpperCase()}`
  if (section === 'FERIADOS') return editing ? 'EDIÇÃO DE FERIADO' : 'NOVO FERIADO'
  if (section === 'METAS') return editing ? 'EDIÇÃO DE META' : 'NOVA META'
  if (section === 'FORNECEDORES') return editing ? 'EDIÇÃO DE FORNECEDOR' : 'NOVO FORNECEDOR'
  if (section === 'PRODUTOS') return editing ? 'EDIÇÃO DE PRODUTO' : 'NOVO PRODUTO'
  return reactivating ? 'REATIVAÇÃO POR NOVA VIGÊNCIA' : 'NOVA VIGÊNCIA'
}

export function modalTitle(
  section: CatalogSection,
  editing: boolean,
  named: NamedDraft,
  holiday: HolidayDraft,
  goal: GoalDraft,
  provider: ProviderDraft,
  product: ProductDraft,
  reactivating: boolean,
) {
  if (isNamedSection(section)) return editing ? named.nome || `Editar ${namedSectionLabel(section).toLowerCase()}` : `Cadastrar ${namedSectionLabel(section).toLowerCase()}`
  if (section === 'FERIADOS') return editing ? holiday.denominacao || 'Editar feriado' : 'Cadastrar feriado'
  if (section === 'METAS') return editing ? `Meta ${competenceLabel(goal.competencia)}` : 'Cadastrar meta de mão de obra'
  if (section === 'FORNECEDORES') return editing ? provider.nome || 'Editar fornecedor' : 'Cadastrar fornecedor'
  if (section === 'PRODUTOS') return editing ? product.nome || 'Editar produto' : 'Cadastrar produto'
  if (section === 'PRECOS_MO') return reactivating ? 'Reativar preço de mão de obra' : 'Preço de mão de obra'
  return reactivating ? 'Reativar preço de produto' : 'Preço de produto'
}

export function modalDescription(section: CatalogSection, reactivating: boolean) {
  if (isNamedSection(section)) return 'O status controla a disponibilidade em novos lançamentos sem apagar referências históricas.'
  if (section === 'FERIADOS') return 'O calendário ativo é utilizado pela regra de classificação de feriados.'
  if (section === 'METAS') return 'A meta é global por competência e alimenta os indicadores de mão de obra do Dashboard.'
  if (section === 'FORNECEDORES') return 'Configure elegibilidade, status e destino de WhatsApp.'
  if (section === 'PRODUTOS') return 'Defina categoria e status. Reativar o produto não altera preços históricos.'
  if (reactivating) return 'Será criada uma nova linha de vigência; o registro anterior permanece preservado.'
  return 'A nova vigência encerra automaticamente a anterior do mesmo vínculo.'
}

export function saveButtonLabel(section: CatalogSection, editing: boolean, reactivating: boolean) {
  if (!isPriceSection(section)) return editing ? 'Salvar alterações' : 'Cadastrar'
  return reactivating ? 'Criar reativação' : 'Criar vigência'
}
