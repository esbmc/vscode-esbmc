import { Request, default as fetch } from 'node-fetch';

export async function getLatestVersion() {
    let request = new Request("https://github.com/esbmc/esbmc/releases/latest");
    const response = await fetch(request);
    const redirUrl = response.url;
    return redirUrl.split('/').pop();
}