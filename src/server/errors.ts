/** Error dengan status HTTP; dilempar dari layer server dan diubah jadi respons JSON. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return Response.json({ error: "Terjadi kesalahan di server." }, { status: 500 });
}
