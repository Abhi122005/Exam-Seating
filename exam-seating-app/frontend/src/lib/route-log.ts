export function withRouteLogging<T extends (...args: any[]) => Promise<Response>>(
  route: string,
  handler: T,
): T {
  return (async (...args: Parameters<T>) => {
    const startedAt = Date.now();
    try {
      const response = await handler(...args);
      console.info(JSON.stringify({ route, status: response.status, ms: Date.now() - startedAt }));
      return response;
    } catch (error) {
      console.warn(JSON.stringify({ route, status: 500, ms: Date.now() - startedAt }));
      throw error;
    }
  }) as T;
}
