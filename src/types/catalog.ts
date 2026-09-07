export type TipoSolicitacao = 'MAO_DE_OBRA' | 'ALIMENTACAO_BEBIDA'
export type WhatsappDestino = 'NENHUM' | 'NUMERO' | 'GRUPO'

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

export type CategoriaProduto = 'ALIMENTACAO' | 'BEBIDA'

export interface ProdutoDto {
  nome: string
  categoria: CategoriaProduto
}

export interface CatalogosDto {
  operacoes: CatalogoNomeDto[]
  supervisores: CatalogoNomeDto[]
  fornecedores: FornecedorDto[]
  atividades: CatalogoNomeDto[]
  funcoes: CatalogoNomeDto[]
  produtos: ProdutoDto[]
}

export interface CatalogosAdminDto {
  fornecedores: FornecedorAdminDto[]
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

export type FornecedorAdminApiResponse =
  | {
      ok: true
      data: FornecedorAdminDto
    }
  | {
      ok: false
      error: ApiErrorDto
    }
