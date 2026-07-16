export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export function errorResponse(error: unknown) {
  if (error instanceof HttpError) {
    return json({ error: error.message }, error.status);
  }

  console.error('Unhandled function error', error);
  return json({ error: 'The secure memory service could not complete this request.' }, 500);
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return await request.json() as T;
  } catch {
    throw new HttpError(400, 'A valid JSON request body is required.');
  }
}

export function methodNotAllowed() {
  return json({ error: 'Method not allowed.' }, 405);
}
