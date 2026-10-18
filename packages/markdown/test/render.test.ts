import { describe, expect, it } from 'vitest';
import {
  extractMediaIds,
  frenchSpaces,
  isExternalHref,
  type MediaRef,
  type RenderContext,
  readingTime,
  render,
  slugify,
} from '../src/index';

const NNBSP = ' ';
const ID = 'abcdefghijklmno';

const media: MediaRef = {
  id: ID,
  url: '/api/files/media/abcdefghijklmno/photo.jpg',
  thumbs: { 480: '/t/480.jpg', 960: '/t/960.jpg', 1920: '/t/1920.jpg' },
  alt: 'Alt du média',
  caption: 'Fig. 01 — Légende',
  width: 1600,
  height: 900,
};
const ctx: RenderContext = { resolveMedia: (id) => (id === ID ? media : null) };

const html = async (md: string, c: RenderContext = {}) => (await render(md, c)).html;

describe('directives', () => {
  it(':::note et :::warning → aside avec étiquette', async () => {
    const out = await html(':::note\nUn **point** utile.\n:::\n\n:::warning\nDanger.\n:::');
    expect(out).toMatchInlineSnapshot(`
      "<aside class="md-callout md-callout--note"><p class="md-callout__label">NOTE</p><p>Un <strong>point</strong> utile.</p></aside>
      <aside class="md-callout md-callout--warning"><p class="md-callout__label">ATTENTION</p><p>Danger.</p></aside>"
    `);
  });

  it('étiquette personnalisée :::note[…]', async () => {
    expect(await html(':::note[À savoir]\nTexte.\n:::')).toContain(
      '<p class="md-callout__label">À savoir</p><p>Texte.</p>',
    );
  });

  it('::youtube → façade sans iframe', async () => {
    const out = await html('::youtube{id=dQw4w9WgXcQ}');
    expect(out).toBe(
      '<div class="md-embed" data-youtube="dQw4w9WgXcQ"><button type="button">[ LIRE LA VIDÉO ]</button></div>',
    );
    expect(out).not.toContain('iframe');
  });

  it('::youtube avec un id invalide → texte', async () => {
    const out = await html('::youtube{id="x" onload="alert(1)"}');
    expect(out).not.toContain('md-embed');
    expect(out).not.toContain('<iframe');
    expect(out.startsWith('<p>::youtube')).toBe(true);
  });

  it('directives inconnues → texte brut', async () => {
    expect(await html('Il est :abbr[HTML]{title=x} ici.')).toBe('<p>Il est :abbr[HTML]{title="x"} ici.</p>');
    expect(await html('::foo[bar]')).toBe('<p>::foo[bar]</p>');
    expect(await html(':::spoiler\nCaché\n:::')).toBe('<p>:::spoiler</p>\n<p>Caché</p>');
  });

  it('les heures et URLs ne deviennent pas des directives', async () => {
    expect(await html('Rendez-vous à 10:30, voir https://example.com.')).toContain('10:30');
  });
});

describe('médias', () => {
  it('image media: seule → figure (sans <p>) avec srcset', async () => {
    const out = await html(`![Texte alt](media:${ID})`, ctx);
    expect(out).toMatchInlineSnapshot(
      `"<figure class="md-figure"><img src="/t/960.jpg" srcset="/t/480.jpg 480w, /t/960.jpg 960w, /t/1920.jpg 1920w" sizes="(max-width: 760px) 100vw, 760px" width="1600" height="900" alt="Texte alt" loading="lazy" decoding="async"><figcaption>Fig. 01 — Légende</figcaption></figure>"`,
    );
  });

  it('alt vide → alt du média', async () => {
    expect(await html(`![](media:${ID})`, ctx)).toContain('alt="Alt du média"');
  });

  it('média introuvable → placeholder', async () => {
    const out = await html('![x](media:zzzzzzzzzzzzzzz)', ctx);
    expect(out).toBe('<figure class="md-figure md-figure--missing">[ MÉDIA INTROUVABLE ]</figure>');
  });

  it('sans resolveMedia → placeholder', async () => {
    expect(await html(`![x](media:${ID})`)).toContain('md-figure--missing');
  });

  it('média en ligne → img dans le paragraphe', async () => {
    const out = await html(`Avant ![x](media:${ID}) après.`, ctx);
    expect(out.startsWith('<p>Avant <img src="/t/960.jpg"')).toBe(true);
    expect(out).not.toContain('<figure');
  });

  it('image externe : conservée, lazy', async () => {
    expect(await html('![ext](https://example.com/a.png)')).toBe(
      '<p><img src="https://example.com/a.png" alt="ext" loading="lazy" decoding="async"></p>',
    );
  });

  it('mediaIds collectés depuis le document', async () => {
    const r = await render(`![a](media:${ID})\n\n![b](media:zzzzzzzzzzzzzzz) ![c](media:${ID})`, ctx);
    expect(r.mediaIds).toEqual([ID, 'zzzzzzzzzzzzzzz']);
    expect(extractMediaIds(`![a](media:${ID}) ![b](media:${ID})`)).toEqual([ID]);
  });
});

describe('code', () => {
  it('bloc avec title → figure.md-code + couleurs nd-01', async () => {
    const out = await html('```ts title="loop.ts"\n// commentaire\nconst x = "s";\n```');
    expect(out).toMatch(
      /^<figure class="md-code"><figcaption><span>loop\.ts<\/span><button type="button" class="md-code__copy" data-copy>\[ COPIER \]<\/button><\/figcaption><pre style="background-color:#121212;color:#D6D6D6" tabindex="0"><code>/,
    );
    expect(out).toContain('<span style="color:#FF2A2A">const</span>');
    expect(out).toContain('<span style="color:#8C8C8C">// commentaire</span>');
    expect(out.endsWith('</code></pre></figure>')).toBe(true);
  });

  it('sans title → la légende affiche le langage', async () => {
    expect(await html('```bash\necho hi\n```')).toContain('<figcaption><span>bash</span>');
  });

  it.each([
    'ts',
    'tsx',
    'js',
    'json',
    'bash',
    'sh',
    'css',
    'html',
    'csharp',
    'gdscript',
    'go',
    'rust',
    'glsl',
    'yaml',
    'md',
    'diff',
  ])('langage %s colorié', async (lang) => {
    expect(await html(`\`\`\`${lang}\nx\n\`\`\``)).toContain('<figure class="md-code">');
  });

  it('langage inconnu → <pre><code> brut, échappé', async () => {
    expect(await html('```cobol\nplain <b>\n```')).toBe(
      '<pre tabindex="0"><code class="language-cobol">plain &#x3C;b>\n</code></pre>',
    );
  });

  it('langage inconnu avec title → figure sans coloration', async () => {
    const out = await html('```cobol title="a.cob"\nx\n```');
    expect(out).toContain('<figcaption><span>a.cob</span>');
    expect(out).toContain('<pre tabindex="0"><code class="language-cobol">x\n</code></pre>');
  });

  it('pas de typographie française dans le code', async () => {
    const out = await html('Texte `a ? b : c` fin.\n\n```\nx ? y : z\n```');
    expect(out).toContain('<code>a ? b : c</code>');
    expect(out).toContain('x ? y : z');
  });
});

describe('sanitisation', () => {
  it('HTML brut supprimé (<script>, onerror)', async () => {
    const out = await html(
      '<script>alert(1)</script>\n\nA <img src=x onerror=alert(1)> B\n\n<div onclick="x">d</div>',
    );
    expect(out).not.toMatch(/<script|onerror|onclick|alert\(1\)<\/script>/);
    expect(out).toBe('<p>A  B</p>');
  });

  it('liens javascript: neutralisés', async () => {
    const out = await html('[clic](javascript:alert(1)) et [b](JaVaScRiPt:alert(1))');
    expect(out).not.toMatch(/javascript:/i);
    expect(out).toBe('<p><a>clic</a> et <a>b</a></p>');
  });

  it('image javascript: / data: neutralisée', async () => {
    expect(await html('![x](javascript:alert(1))')).not.toMatch(/javascript:/i);
  });

  it('attributs de directive non autorisés supprimés', async () => {
    const out = await html(':::note{onclick="alert(1)" style="color:red"}\nx\n:::');
    expect(out).not.toMatch(/onclick|style/);
  });
});

describe('typographie française', () => {
  it('espace fine insécable avant : ; ! ? » et après «', async () => {
    const out = await html('Question ? Oui ! Note : « citation » ; fin.');
    expect(out).toBe(
      `<p>Question${NNBSP}? Oui${NNBSP}! Note${NNBSP}: «${NNBSP}citation${NNBSP}»${NNBSP}; fin.</p>`,
    );
  });

  it('frenchSpaces ne touche pas les deux-points collés', () => {
    expect(frenchSpaces('https://x.be 10:30')).toBe('https://x.be 10:30');
    expect(frenchSpaces('a ?')).toBe(`a${NNBSP}?`);
  });
});

describe('titres et TOC', () => {
  it('slugs lisibles, ancres, TOC h2/h3', async () => {
    const r = await render(
      '# Titre\n\n## Écrire une boucle\n\n### Déjà vu ?\n\n#### Profond\n\n## Écrire une boucle',
    );
    expect(r.toc).toEqual([
      { depth: 2, text: 'Écrire une boucle', id: 'ecrire-une-boucle' },
      { depth: 3, text: `Déjà vu${NNBSP}?`, id: 'deja-vu' },
      { depth: 2, text: 'Écrire une boucle', id: 'ecrire-une-boucle-1' },
    ]);
    expect(r.html).toContain(
      '<h2 id="ecrire-une-boucle">Écrire une boucle<a class="md-anchor" aria-hidden="true" tabindex="-1" href="#ecrire-une-boucle">#</a></h2>',
    );
    expect(r.html).toContain('<h4 id="profond">');
  });

  it('slugify', () => {
    expect(slugify('Œuvre & cœur : ça marche !')).toBe('oeuvre-coeur-ca-marche');
    expect(slugify('???')).toBe('section');
  });
});

describe('liens', () => {
  it('externes → target/rel, internes intacts', async () => {
    const out = await html(
      '[a](https://example.com) [b](/journal) [c](#x) [d](https://dessenius.be/a) <https://x.org>',
    );
    expect(out).toBe(
      '<p><a href="https://example.com" target="_blank" rel="noopener noreferrer">a</a> <a href="/journal">b</a> <a href="#x">c</a> <a href="https://dessenius.be/a">d</a> <a href="https://x.org" target="_blank" rel="noopener noreferrer">https://x.org</a></p>',
    );
    expect(isExternalHref('//cdn.example.com/x')).toBe(true);
    expect(isExternalHref('mailto:a@b.c')).toBe(false);
  });
});

describe('tableaux', () => {
  it('enveloppés dans div.md-table', async () => {
    const out = await html('| a | b |\n|---|--:|\n| 1 | 2 |');
    expect(out).toMatchInlineSnapshot(`
      "<div class="md-table"><table>
      <thead>
      <tr>
      <th>a</th>
      <th align="right">b</th>
      </tr>
      </thead>
      <tbody>
      <tr>
      <td>1</td>
      <td align="right">2</td>
      </tr>
      </tbody>
      </table></div>"
    `);
  });
});

describe('GFM divers', () => {
  it('notes de bas de page : ids cohérents', async () => {
    const out = await html('Texte[^1].\n\n[^1]: Note.');
    expect(out).toContain('href="#user-content-fn-1" id="user-content-fnref-1"');
    expect(out).toContain('<li id="user-content-fn-1">');
    expect(out).toContain('<h2 class="sr-only" id="footnote-label">Notes</h2>');
    expect(out).not.toContain('md-anchor');
  });

  it('listes de tâches', async () => {
    expect(await html('- [x] fait')).toContain('<input type="checkbox" checked disabled>');
  });
});

describe('readingTime', () => {
  it('≈ 220 mots/min, minimum 1', async () => {
    expect(readingTime('')).toBe(1);
    expect(readingTime('mot '.repeat(660))).toBe(3);
    expect((await render('mot '.repeat(440))).readingTime).toBe(2);
  });
});

describe('document complet', () => {
  it('snapshot', async () => {
    const md = [
      '## Micro : l’action',
      '',
      'Un paragraphe avec un [lien](https://example.com) et du `code`.',
      '',
      '> Une citation.',
      '',
      ':::note',
      'Encart.',
      ':::',
      '',
      `![](media:${ID})`,
      '',
      '```gdscript title="player.gd"',
      'func _ready():',
      '\tpass # rien',
      '```',
    ].join('\n');
    expect(await html(md, ctx)).toMatchSnapshot();
  });
});
