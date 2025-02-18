import { NodeHtmlMarkdown } from 'node-html-markdown';

const jsonResponse = (body: unknown, status: number = 200) => {
	return new Response(
		JSON.stringify(body),
		{ status, headers: { 'Content-Type': 'application/json' } }
	);
};

const errorResponse = (message: string, status: number = 400) => {
	return jsonResponse({ error: message, code: status }, status);
};

const getParams = (request: Request): { url: string | null, limit: number | null } => {
	const params = new URL(request.url).searchParams;
	return {
		url: params.get('url'),
		limit: params.get('limit') ? parseInt(params.get('limit') || '0', 10) : null,
	};
};

const getCachedResponse = async (request: Request): Promise<Response | undefined> => {
	const cache = caches.default;
	return await cache.match(request);
};

const setCachedResponse = async (request: Request, response: Response) => {
	const cache = caches.default;
	const clone = response.clone();
	await cache.put(request, clone);
};

const convertToMarkdown = (html: string, limit: number | null): string => {
	const markdown = NodeHtmlMarkdown.translate(html, {});
	return limit ? markdown.slice(0, limit) : markdown;
};

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const { url, limit } = getParams(request);
		if (!url) return errorResponse('Missing URL parameter');

		const cachedResponse = await getCachedResponse(request);
		if (cachedResponse) return cachedResponse;

		const response = await fetch(url);
		if (!response.ok)
			return errorResponse('Failed to fetch URL', response.status);

		const body = await response.text();
		const markdown = convertToMarkdown(body, limit);

		const json = jsonResponse({
			url,
			limit,
			created: new Date().toISOString(),
			body: markdown,
		});
		ctx.waitUntil(setCachedResponse(request, json));
		return json;
	},
} satisfies ExportedHandler<Env>;
