import { createRouter, createWebHistory } from 'vue-router';
import BoardView from './views/BoardView.vue';
import TaskView from './views/TaskView.vue';
import WorkspaceView from './views/WorkspaceView.vue';

// A link from before the page's addresses were paths (`/#/projects/<id>`), the command line's own included: the token
// swap keeps its fragment, and the fragment becomes the path.
if (location.hash.startsWith('#/')) history.replaceState(history.state, '', location.hash.slice(1));

/** The page's addresses, as paths: `/projects/<id>` and `/projects/<id>/tasks/<task>`; the server answers each with the page. */
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: WorkspaceView },
    { path: '/projects/:id', component: BoardView, props: true },
    { path: '/projects/:id/tasks/:task', component: TaskView, props: (route) => ({ project: route.params.id, task: route.params.task }) },
    // The maintainer's page of every component; loaded only when opened, linked from nowhere.
    { path: '/canvas', component: () => import('./views/CanvasView.vue') },
    { path: '/:rest(.*)*', redirect: '/' },
  ],
});
