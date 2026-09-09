export type TipoSolicitacao = 'MAO_DE_OBRA' | 'ALIMENTACAO_BEBIDA'
export type WhatsappDestino = 'NENHUM' | 'NUMERO' | 'GRUPO'
export type CategoriaProduto = 'ALIMENTACAO' | 'BEBIDA'
export type TipoDia = 'UTIL' | 'SABADO' | 'DOMINGO_FERIADO'
export type CatalogAdminScope = 'RESUMO' | 'FORNECEDORES' | 'PRODUTOS' | 'PRECOS_MO' | 'PRECOS_PRODUTOS'

export interface CatalogoNomeDto {
  nome: string
}

export interface FornecedorDto {
  nome: string
  tiposSolicitacao: TipoSolicitacao[]
  whatsappDestino?: WhatsappDestino
  whatsappNumero?: string
  whatsappGrupoLink?: string
}

export interface FornecedorAdminDto {
  nome: string
  maoDeObra: boolean
  alimentacao: boolean
  ativo: boolean
  whatsappDestino: WhatsappDestino
  whatsappNumero: string
  whatsappGrupoLink: string
}

export interface ProdutoDto {
  nome: string
  categoria: CategoriaProduto
}

export interface ProdutoAdminDto {
  nome: string
  categoria: CategoriaProduto
  ativo: boolean
}

export interface PrecoMaoObraAdminDto {
  fornecedor: string
  funcao: string
  turno: 'DIURNO' | 'NOTURNO'
  tipoDia: TipoDia
  vigenciaInicio: string
  vigenciaFim: string
  precoUnitario: number
  ativo: boolean
}

export interface PrecoProdutoAdminDto {
  fornecedor: string
  produto: string
  categoria: CategoriaProduto
  vigenciaInicio: string
  vigenciaFim: string
  precoUnitario: number
  ativo: boolean
}

export interface CatalogosDto {
  operacoes: CatalogoNomeDto[]
  supervisores: CatalogoNomeDto[]
  fornecedores: FornecedorDto[]
  atividades: CatalogoNomeDto[]
  funcoes: CatalogoNomeDto[]
  produtos: ProdutoDto[]
}

export interface CatalogosAdminResumoDto {
  operacoes: number
  supervisores: number
  fornecedores: number
  atividades: number
  funcoes: number
  produtos: number
}

export interface CatalogosAdminDto {
  resumoAtivos: CatalogosAdminResumoDto
  funcoes: CatalogoNomeDto[]
  fornecedores: FornecedorAdminDto[]
  produtos: ProdutoAdminDto[]
  precosMaoObra: PrecoMaoObraAdminDto[]
  precosProdutos: PrecoProdutoAdminDto[]
}

export interface CatalogosAdminScopeDto {
  resumoAtivos?: CatalogosAdminResumoDto
  funcoes?: CatalogoNomeDto[]
  fornecedores?: FornecedorAdminDto[]
  produtos?: ProdutoAdminDto[]
  precosMaoObra?: PrecoMaoObraAdminDto[]
  precosProdutos?: PrecoProdutoAdminDto[]
}

export interface SaveFornecedorAdminInput {
  fornecedor: string
  maoDeObra: boolean
  alimentacao: boolean
  ativo: boolean
  whatsappDestino: WhatsappDestino
  whatsappNumero?: string
  whatsappGrupoLink?: string
}

export interface SaveProdutoAdminInput {
  produto: string
  categoria: CategoriaProduto
  ativo: boolean
}

export interface SavePrecoMaoObraAdminInput {
  fornecedor: string
  funcao: string
  turno: 'DIURNO' | 'NOTURNO'
  tipoDia: TipoDia
  vigenciaInicio: string
  precoUnitario: number
}

export interface SavePrecoProdutoAdminInput {
  fornecedor: string
  produto: string
  vigenciaInicio: string
  precoUnitario: number
}

export interface ApiErrorDto {
  code: string
  message: string
  details?: unknown
}

export type CatalogosApiResponse =
  | {
      ok: true
      data: CatalogosDto
    }
  | {
      ok: false
      error: ApiErrorDto
    }

export type CatalogosAdminApiResponse =
  | {
      ok: true
      data: CatalogosAdminDto
    }
  | {
      ok: false
      error: ApiErrorDto
    }

export type CatalogosAdminScopeApiResponse =
  | {
      ok: true
      data: CatalogosAdminScopeDto
    }
  | {
      ok: false
      error: ApiErrorDto
    }

export type FornecedorAdminApiResponse =
  | {
      ok: true
      data: FornecedorAdminDto
    }
  | {
      ok: false
      error: ApiErrorDto
    }

export type ProdutoAdminApiResponse =
  | {
      ok: true
      data: ProdutoAdminDto
    }
  | {
      ok: false
      error: ApiErrorDto
    }

export type PrecoMaoObraAdminApiResponse =
  | {
      ok: true
      data: PrecoMaoObraAdminDto
    }
  | {
      ok: false
      error: ApiErrorDto
    }

export type PrecoProdutoAdminApiResponse =
  | {
      ok: true
      data: PrecoProdutoAdminDto
    }
  | {
      ok: false
      error: ApiErrorDto
    }
