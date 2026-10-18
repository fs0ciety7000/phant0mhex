import './admin.css';
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClientResponseError } from 'pocketbase';
import { lazy, type ReactNode, Suspense, useEffect, useState } from 'react';
import { Layout } from './Layout';
import { useEditor } from './lib/auth';
import { createPb, PbContext, type TypedPocketBase, usePb } from './lib/pb';
import { match, navigate, usePathname } from './lib/router';
import { Login } from './pages/Login';
import { MediaLibrary } from './pages/MediaLibrary';
import { PostsList } from './pages/PostsList';
import { ProjectsList } from './pages/ProjectsList';
import { Categories, Tags } from './pages/Taxonomies';
import { DialogProvider } from './ui/Dialogs';
import { ToastProvider } from './ui/Toasts';

// Les écrans qui embarquent CodeMirror sont chargés à la demande.
const PostEditorRoute = lazy(() => import('./pages/PostEditor'));
const ProjectEditor = lazy(() => import('./pages/ProjectEditor'));
const Settings = lazy(() => import('./pages/Settings'));

function isAuthError(e: unknown): boolean {
  return e instanceof ClientResponseError && e.status === 401;
}

export default function AdminApp({ pbUrl }: { pbUrl: string }) {
  const [pb] = useState<TypedPocketBase>(() => createPb(pbUrl));
  const [qc] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (e) => {
            if (isAuthError(e)) pb.authStore.clear();
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: (n, e) =>
              !(e instanceof ClientResponseError && [400, 401, 403, 404].includes(e.status)) && n < 2,
          },
        },
      }),
  );
  const [ready, setReady] = useState(false);

  // Rafraîchit le jeton au chargement (session persistée par l'authStore du SDK).
  useEffect(() => {
    if (!pb.authStore.isValid || pb.authStore.record?.collectionName !== 'editors') {
      pb.authStore.clear();
      setReady(true);
      return;
    }
    pb.collection('editors')
      .authRefresh()
      .catch((e) => {
        if (e instanceof ClientResponseError && e.status !== 0) pb.authStore.clear();
      })
      .finally(() => setReady(true));
  }, [pb]);

  return (
    <PbContext.Provider value={pb}>
      <QueryClientProvider client={qc}>
        <ToastProvider>
          <DialogProvider>{ready ? <Routes /> : <Boot label="Vérification de la session…" />}</DialogProvider>
        </ToastProvider>
      </QueryClientProvider>
    </PbContext.Provider>
  );
}

function Boot({ label }: { label: string }) {
  return (
    <p className="adm-boot" role="status">
      {label}
    </p>
  );
}

function Redirect({ to }: { to: string }) {
  useEffect(() => navigate(to, { replace: true }), [to]);
  return null;
}

function Routes() {
  const pb = usePb();
  const editor = useEditor(pb);
  const path = usePathname();
  const rel = path.replace(/^\/admin\/?/, '').replace(/\/$/, '');

  if (rel === 'login') {
    if (editor) {
      const next = new URLSearchParams(location.search).get('next');
      return <Redirect to={next?.startsWith('/admin') ? next : '/admin/billets'} />;
    }
    return <Login />;
  }
  if (!editor) {
    return <Redirect to={`/admin/login?next=${encodeURIComponent(path + location.search)}`} />;
  }

  if (rel === '') return <Redirect to="/admin/billets" />;
  const postId = match('billets/:id', rel)?.id;
  const projectId = match('projets/:id', rel)?.id;
  let section = rel.split('/')[0] ?? '';
  let page: ReactNode;
  if (rel === 'billets') page = <PostsList />;
  else if (postId) page = <PostEditorRoute param={postId} />;
  else if (rel === 'categories') page = <Categories />;
  else if (rel === 'tags') page = <Tags />;
  else if (rel === 'medias') page = <MediaLibrary />;
  else if (rel === 'projets') page = <ProjectsList />;
  else if (projectId) page = <ProjectEditor key={projectId} param={projectId} />;
  else if (rel === 'reglages') page = <Settings />;
  else {
    section = '';
    page = (
      <div className="adm-page">
        <p className="adm-empty">[ 404 ] Écran inconnu.</p>
      </div>
    );
  }

  return (
    <Layout section={section} editor={editor}>
      <Suspense fallback={<Boot label="Chargement du module…" />}>{page}</Suspense>
    </Layout>
  );
}
