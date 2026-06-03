'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useConfirm } from '@/components/shared/ConfirmDialog';
import {
  useDeleteWorkspaceMutation,
  useGetWorkspaceQuery,
  useUpdateWorkspaceMutation,
} from '@/features/workspaces/workspaceApi';
import { useWorkspacePermissions } from '@/hooks/usePermissions';

interface FormData {
  name: string;
  description?: string;
}

export default function WorkspaceSettingsPage() {
  const { wsId } = useParams<{ wsId: string }>();
  const router = useRouter();
  const perms = useWorkspacePermissions(wsId);
  const confirm = useConfirm();

  const { data: ws, isLoading: wsLoading } = useGetWorkspaceQuery({ workspaceId: wsId });
  const [update, { isLoading }] = useUpdateWorkspaceMutation();
  const [remove, { isLoading: isDeleting }] = useDeleteWorkspaceMutation();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormData>();

  useEffect(() => {
    if (ws) reset({ name: ws.name, description: ws.description ?? '' });
  }, [ws, reset]);

  // While the workspace is loading we don't know permissions yet — show nothing
  if (wsLoading) {
    return (
      <div className="container mx-auto max-w-xl px-6 py-8">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!perms.canEditWorkspace) {
    return (
      <div className="container mx-auto max-w-xl px-6 py-8">
        <p className="text-muted-foreground">
          Only admins and the owner can edit workspace settings.
        </p>
      </div>
    );
  }

  // FIX: wrap in try/catch — listenerMiddleware handles the toast but the
  // component would otherwise swallow the rejection silently.
  const onSave = async (data: FormData) => {
    try {
      await update({
        workspaceId: wsId,
        input: { name: data.name, description: data.description },
      }).unwrap();
      toast.success('Settings saved');
    } catch {
      // toast fired by listenerMiddleware
    }
  };

  const onDelete = async () => {
    const ok = await confirm({
      title: 'Delete this workspace?',
      description:
        'All boards, tasks, bugs, and comments in this workspace will be permanently deleted. This cannot be undone.',
      confirmText: 'Delete workspace',
      destructive: true,
    });
    if (!ok) return;
    try {
      await remove({ workspaceId: wsId }).unwrap();
      toast.success('Workspace deleted');
      router.push('/dashboard');
    } catch {
      // toast fired by listenerMiddleware
    }
  };

  return (
    <div className="container mx-auto max-w-2xl space-y-6 px-6 py-8">
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSave)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ws-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="ws-name"
                {...register('name', {
                  required: 'Name is required',
                  minLength: { value: 2, message: 'Minimum 2 characters' },
                })}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="ws-desc">Description</Label>
              <Textarea
                id="ws-desc"
                rows={3}
                {...register('description')}
              />
            </div>
            <Button type="submit" disabled={isLoading || !isDirty}>
              {isLoading ? 'Saving…' : 'Save changes'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {perms.canDeleteWorkspace && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Danger zone</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Deleting a workspace is permanent and cannot be undone.
            </p>
            <Button
              variant="destructive"
              onClick={onDelete}
              disabled={isDeleting}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              {isDeleting ? 'Deleting…' : 'Delete workspace'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
