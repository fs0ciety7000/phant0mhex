/// <reference path="../pb_data/types.d.ts" />
// Schéma initial (docs/ARCHITECTURE.md §4) : editors, categories, tags, posts, media, projects, site.
// Les règles d'accès sont la frontière de sécurité : un billet n'est lisible publiquement que
// s'il est publié ET que sa date de publication est passée.

const EDITOR = '@request.auth.collectionName = "editors"';
const POST_PUBLIC = 'status = "published" && published_at != "" && published_at <= @now';
const SLUG_PATTERN = '^[a-z0-9]+(?:-[a-z0-9]+)*$';
const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
const THUMBS = ['480x0', '960x0', '1920x0'];
const MB = 1024 * 1024;
const LONG_TEXT = 500000;

const timestamps = () => [
  { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
  { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
];

const slugField = () => ({
  name: 'slug',
  type: 'text',
  required: true,
  max: 200,
  pattern: SLUG_PATTERN,
  presentable: false,
});

const imageField = (name, extra) =>
  Object.assign(
    {
      name,
      type: 'file',
      maxSelect: 1,
      maxSize: 15 * MB,
      mimeTypes: IMAGE_MIMES,
      thumbs: THUMBS,
    },
    extra || {},
  );

// Lecture publique, écriture réservée aux éditeurs.
const publicReadRules = {
  listRule: '',
  viewRule: '',
  createRule: EDITOR,
  updateRule: EDITOR,
  deleteRule: EDITOR,
};

migrate(
  (app) => {
    // --- editors (auth) ------------------------------------------------------
    const editors = new Collection({
      type: 'auth',
      name: 'editors',
      // Pas d'inscription publique : seuls les superusers créent/suppriment des éditeurs.
      listRule: EDITOR,
      viewRule: EDITOR,
      createRule: null,
      updateRule: 'id = @request.auth.id',
      deleteRule: null,
      passwordAuth: { enabled: true, identityFields: ['email'] },
      otp: { enabled: true, duration: 300, length: 8 },
      mfa: { enabled: true, duration: 1800, rule: '' },
    });
    editors.fields.add(new TextField({ name: 'name', max: 120 }));
    editors.fields.add(
      new FileField({
        name: 'avatar',
        maxSelect: 1,
        maxSize: 5 * MB,
        mimeTypes: IMAGE_MIMES,
        thumbs: ['96x96', '192x192'],
      }),
    );
    for (const f of timestamps()) editors.fields.add(new AutodateField(f));
    app.save(editors);

    // --- categories ----------------------------------------------------------
    const categories = new Collection(
      Object.assign(
        {
          type: 'base',
          name: 'categories',
          fields: [
            { name: 'name', type: 'text', required: true, max: 120, presentable: true },
            slugField(),
            { name: 'description', type: 'text', max: 2000 },
            { name: 'order', type: 'number', onlyInt: true },
            ...timestamps(),
          ],
          indexes: ['CREATE UNIQUE INDEX `idx_categories_slug` ON `categories` (`slug`)'],
        },
        publicReadRules,
      ),
    );
    app.save(categories);

    // --- tags ----------------------------------------------------------------
    const tags = new Collection(
      Object.assign(
        {
          type: 'base',
          name: 'tags',
          fields: [
            { name: 'name', type: 'text', required: true, max: 120, presentable: true },
            slugField(),
            ...timestamps(),
          ],
          indexes: ['CREATE UNIQUE INDEX `idx_tags_slug` ON `tags` (`slug`)'],
        },
        publicReadRules,
      ),
    );
    app.save(tags);

    // --- posts ---------------------------------------------------------------
    const posts = new Collection({
      type: 'base',
      name: 'posts',
      listRule: `${EDITOR} || (${POST_PUBLIC})`,
      viewRule: `${EDITOR} || (${POST_PUBLIC})`,
      createRule: EDITOR,
      updateRule: EDITOR,
      deleteRule: EDITOR,
      fields: [
        { name: 'title', type: 'text', required: true, max: 200, presentable: true },
        slugField(),
        { name: 'excerpt', type: 'text', max: 1000 },
        { name: 'body', type: 'text', max: LONG_TEXT },
        imageField('cover'),
        {
          name: 'category',
          type: 'relation',
          collectionId: categories.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'tags',
          type: 'relation',
          collectionId: tags.id,
          maxSelect: 50,
          cascadeDelete: false,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['draft', 'scheduled', 'published'],
        },
        { name: 'published_at', type: 'date' },
        { name: 'reading_time', type: 'number', onlyInt: true, min: 0 },
        { name: 'seo_title', type: 'text', max: 200 },
        { name: 'seo_description', type: 'text', max: 400 },
        { name: 'featured', type: 'bool' },
        { name: 'revision', type: 'number', onlyInt: true, min: 0 },
        ...timestamps(),
      ],
      indexes: [
        'CREATE UNIQUE INDEX `idx_posts_slug` ON `posts` (`slug`)',
        'CREATE INDEX `idx_posts_status_published_at` ON `posts` (`status`, `published_at`)',
      ],
    });
    app.save(posts);

    // --- media ---------------------------------------------------------------
    const media = new Collection(
      Object.assign(
        {
          type: 'base',
          name: 'media',
          fields: [
            imageField('file', { required: true }),
            { name: 'alt', type: 'text', required: true, max: 300, presentable: true },
            { name: 'caption', type: 'text', max: 1000 },
            { name: 'width', type: 'number', onlyInt: true, min: 0 },
            { name: 'height', type: 'number', onlyInt: true, min: 0 },
            {
              name: 'post',
              type: 'relation',
              collectionId: posts.id,
              maxSelect: 1,
              cascadeDelete: false,
            },
            ...timestamps(),
          ],
        },
        publicReadRules,
      ),
    );
    app.save(media);

    // --- projects ------------------------------------------------------------
    const projects = new Collection(
      Object.assign(
        {
          type: 'base',
          name: 'projects',
          fields: [
            { name: 'title', type: 'text', required: true, max: 200, presentable: true },
            slugField(),
            { name: 'role', type: 'text', max: 200 },
            { name: 'year', type: 'text', max: 40 },
            { name: 'url', type: 'url' },
            { name: 'summary', type: 'text', max: 2000 },
            { name: 'body', type: 'text', max: LONG_TEXT },
            imageField('cover'),
            { name: 'order', type: 'number', onlyInt: true },
            { name: 'featured', type: 'bool' },
            ...timestamps(),
          ],
          indexes: ['CREATE UNIQUE INDEX `idx_projects_slug` ON `projects` (`slug`)'],
        },
        publicReadRules,
      ),
    );
    app.save(projects);

    // --- site (une seule ligne, créée par la migration de seed) ---------------
    // Ni création ni suppression via l'API : la ligne unique est seulement modifiable.
    const site = new Collection({
      type: 'base',
      name: 'site',
      listRule: '',
      viewRule: '',
      createRule: null,
      updateRule: EDITOR,
      deleteRule: null,
      fields: [
        { name: 'bio', type: 'text', max: 20000 },
        // Champ texte (pas email) pour accepter le placeholder « [EMAIL] ».
        { name: 'email', type: 'text', max: 200 },
        { name: 'socials', type: 'json', maxSize: 20000 },
        { name: 'availability', type: 'text', max: 300 },
        { name: 'base', type: 'text', max: 200 },
        ...timestamps(),
      ],
    });
    app.save(site);
  },
  (app) => {
    for (const name of ['site', 'projects', 'media', 'posts', 'tags', 'categories', 'editors']) {
      try {
        app.delete(app.findCollectionByNameOrId(name));
      } catch (_) {
        // déjà absente
      }
    }
  },
);
