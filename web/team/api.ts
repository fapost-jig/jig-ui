import { hc, type InferResponseType } from 'hono/client';
import type { TeamAppType } from '../../server/team/app';

/** The team server's API, typed by its own routes (`TeamAppType`); only its type crosses into the page. */
export const team = hc<TeamAppType>('/').api.team;
type Ok<R> = InferResponseType<R, 200>;

export type Me = Ok<typeof team.me.$get>;
export type Projects = Ok<typeof team.projects.$get>;
export type Project = Projects['projects'][number];
export type Installations = Ok<typeof team.admin.installations.$get>;
export type Installation = Installations['installations'][number];

/** The server's own words for a refusal, or a line of the page's when it did not answer in its form. */
export async function refusal(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => undefined);
  const message = (body as { error?: { message?: unknown } } | undefined)?.error?.message;
  return typeof message === 'string' ? message : `The team server answered ${response.status}.`;
}

/** Why a sign-in came back without a session, as `/auth/callback` names it in `?problem=`. */
export const problems: Record<string, string> = {
  nothing:
    'None of your GitHub accounts may write to a repository this server takes. Ask its admin to approve the installation of your organization, or to install the App on it.',
  taken: 'That GitHub account is linked to someone else on this server already.',
  expired: 'The sign-in took too long, or its link was used already. Sign in again.',
  github: 'GitHub did not complete the sign-in. Try again in a minute.',
  'no-setup': 'Only the browser that created the App signs its admin in, within ten minutes of the setup.',
};
