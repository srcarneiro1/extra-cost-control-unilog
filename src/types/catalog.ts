export type TipoSolicitacao = 'MAO_DE_OBRA' | 'ALIMENTACAO_BEBIDA'

export interface CatalogoNomeDto {
  nome: string
}

export interface FornecedorDto {
  nome: string
  tiposSolicitacao: TipoSolicitacao[]
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
