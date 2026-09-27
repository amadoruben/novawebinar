/**
 * O servidor corta cada resposta a um máximo de linhas (1000 por omissão) sem
 * avisar. Quem precisa de todas para fazer contas pede-as página a página.
 *
 * A consulta tem de vir ordenada por uma coluna estável e, para o fim ser
 * certo seja qual for o corte do servidor, com `{ count: "exact" }`.
 */
type Page<T> = {
  data: T[] | null;
  error: { message: string } | null;
  count?: number | null;
};

const PAGE = 1000;
// ponytail: contas feitas no browser; acima disto passam para funções SQL.
const CEILING = 100_000;

export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<Page<T>>,
): Promise<T[]> {
  const rows: T[] = [];
  while (rows.length < CEILING) {
    const { data, error, count } = await page(rows.length, rows.length + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) return rows;
    rows.push(...data);
    // Sem total, uma página incompleta é a última.
    if (count == null ? data.length < PAGE : rows.length >= count) return rows;
  }
  console.error(`[fetchAll] leitura interrompida às ${CEILING} linhas`);
  return rows;
}
