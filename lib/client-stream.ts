export class RequestError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}

function responseMessage(status: number) {
  if (status === 401 || status === 403) return 'Sign in to use your shopping agent.';
  if (status === 413) return 'That image is too large. Choose an image under 3 MB.';
  if (status === 429) return 'Too many requests. Please wait a moment and try again.';
  if (status === 504) return 'The agent took too long to respond. Please try again.';
  return 'The shopping service could not respond. Please try again.';
}

export async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let data: unknown;
  try { data = text.trim() ? JSON.parse(text) : undefined; } catch { /* HTML platform errors are not JSON. */ }
  if (!response.ok) {
    const message = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : responseMessage(response.status);
    throw new RequestError(message, response.status);
  }
  if (data === undefined) throw new RequestError(responseMessage(response.status), response.status);
  return data as T;
}

export async function readStream<T>(response: Response, onEvent: (event: T) => void) {
  if (!response.ok || response.headers.get('content-type')?.includes('application/json')) {
    onEvent(await readJsonResponse<T>(response));
    return;
  }
  if (!response.body || !response.headers.get('content-type')?.includes('application/x-ndjson')) {
    throw new RequestError(responseMessage(response.status), response.status);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let received = false;
  const parse = (line: string) => {
    let event: T;
    try { event = JSON.parse(line); } catch { throw new RequestError('The connection was interrupted. Please try your search again.', response.status); }
    received = true;
    onEvent(event);
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) if (line.trim()) parse(line);
      if (done) { if (buffer.trim()) parse(buffer); break; }
    }
    if (!received) throw new RequestError(responseMessage(response.status), response.status);
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
