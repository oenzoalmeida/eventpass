import { describe, expect, it } from 'vitest';
import { matchPath } from './router';

describe('matchPath', () => {
  it('extrai parâmetros', () => {
    expect(matchPath('/admin/eventos/:id', '/admin/eventos/42')).toEqual({ id: '42' });
    expect(matchPath('/e/:slug', '/e/semana-tech-a1b2c3/')).toEqual({ slug: 'semana-tech-a1b2c3' });
  });
  it('recusa caminhos diferentes', () => {
    expect(matchPath('/admin/eventos/:id', '/admin/eventos')).toBeNull();
    expect(matchPath('/e/:slug', '/ingresso/abc')).toBeNull();
  });
  it('decodifica segmentos', () => {
    expect(matchPath('/e/:slug', '/e/caf%C3%A9')).toEqual({ slug: 'café' });
  });
});
