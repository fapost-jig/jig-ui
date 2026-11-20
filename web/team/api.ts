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

/** Why a sign-in or a step of the setup came back to the page, as the server names it in `?problem=`. */
export const problems: Record<string, string> = {
  nothing:
    'None of your GitHub accounts may write to a repository this server takes. Ask its admin to approve the installation of your organization, or to install the App on it.',
  taken: 'That GitHub account is linked to someone else on this server already.',
  expired: 'The sign-in took too long, or its link was used already. Sign in again.',
  cancelled: 'The sign-in was cancelled on GitHub. Sign in again when you are ready.',
  github: 'GitHub did not complete the sign-in. Try again in a minute.',
  unauthorized: 'Your session here has ended. Sign in, then link the other account.',
  'no-setup': "The admin's sign-in takes place within ten minutes of entering the setup code. Enter the code again.",
  'not-set-up': 'Nobody signs in until the server is set up.',
  'set-up': 'This server is set up already.',
  'bad-state':
    "That answer from GitHub does not belong to this browser's setup, or came after its ten minutes. Enter the setup code again.",
  'no-app': 'GitHub did not hand over the App. Start the setup again.',
};
