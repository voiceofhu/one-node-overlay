import { z } from 'zod';

export const jsonObjectSchema = z.record(z.string(), z.unknown());

export const overlayConfigSchema = z.object({
  sourceUrl: z.union([
    z.literal(''),
    z
      .url('请输入有效的 HTTPS 订阅地址')
      .refine((value) => new URL(value).protocol === 'https:', '订阅地址必须使用 HTTPS'),
  ]),
  overlay: jsonObjectSchema,
});

export type OverlayConfig = z.infer<typeof overlayConfigSchema>;

export const emptyOverlayConfig: OverlayConfig = {
  sourceUrl: '',
  overlay: {},
};

export function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const location = issue.path.length > 0 ? `${issue.path.join('.')}：` : '';
      return `${location}${issue.message}`;
    })
    .join('\n');
}
