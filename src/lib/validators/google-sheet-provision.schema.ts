import { z } from 'zod';

export const googleSheetTemplateSchema = z.enum(['placement_management', 'scrum_management', 'performance_management', 'central_system']);

export const googleSheetProvisionSchema = z.object({
  title: z.string().trim().min(3, 'Workbook title must be at least 3 characters.').max(100, 'Workbook title must be 100 characters or fewer.'),
  template: googleSheetTemplateSchema,
  folderName: z.string().trim().min(1, 'Folder name cannot be empty.').max(80, 'Folder name must be 80 characters or fewer.').optional(),
  year: z.coerce.number().int().min(2020).max(2100).optional(),
}).superRefine((value, context) => {
  if ((value.template === 'placement_management' || value.template === 'scrum_management') && !value.year) {
    context.addIssue({ code: 'custom', path: ['year'], message: 'Select the workbook year.' });
  }
});

export type GoogleSheetTemplateId = z.infer<typeof googleSheetTemplateSchema>;
export type GoogleSheetProvisionInput = z.infer<typeof googleSheetProvisionSchema>;
