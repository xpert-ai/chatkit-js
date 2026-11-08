import { z } from 'zod';

const base = z.object({
  channel: z.literal('xpertai.remote_component'),
  protocolVersion: z.literal(1),
  instanceId: z.string().optional(),
});
export const presentationMessage = z.discriminatedUnion('type', [
  base.extend({ type: z.literal('ready') }),
  base.extend({
    type: z.literal('requestData'),
    requestId: z.string().min(1).max(128),
  }),
  base.extend({
    type: z.literal('executeAction'),
    requestId: z.string().min(1).max(128),
    actionKey: z.string().min(1).max(80),
    input: z.record(z.string(), z.unknown()),
  }),
]);

/** The opaque iframe has no network, navigation, storage or host-command authority. */
export function isolatePresentationHtml(html: string) {
  const policy = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; frame-src about: blob:; object-src 'none'; base-uri 'none'; form-action 'none'">`;
  if (!/<head(?:\s[^>]*)?>/i.test(html))
    throw new Error('Invalid presentation entry');
  return html.replace(/<head(?:\s[^>]*)?>/i, (head) => head + policy);
}
