// /blog/<chemin> → /journal/<chemin> (billets, catégories, étiquettes).
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ params, redirect, url }) =>
  redirect(`/journal/${params.slug ?? ''}${url.search}`, 301);
