import { randomBytes } from 'node:crypto';

/** Gera um slug legível a partir do título, com sufixo aleatório para evitar colisões. */
export function slugify(title: string): string {
  const base = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  const suffix = randomBytes(3).toString('hex');
  return base ? `${base}-${suffix}` : `evento-${suffix}`;
}
