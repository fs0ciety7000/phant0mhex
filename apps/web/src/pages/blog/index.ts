// /blog → /journal (le blog vit sous /journal ; l'alias suit le vocabulaire courant).
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ redirect, url }) => redirect(`/journal${url.search}`, 301);
