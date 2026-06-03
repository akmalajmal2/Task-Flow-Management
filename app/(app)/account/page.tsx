'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { createClient } from '@/lib/supabase/client';
import { mapSupabaseError } from '@/lib/errors/map';

interface FormData {
  full_name: string;
  is_developer: boolean;
  is_qa: boolean;
}

export default function AccountPage() {
  const { user } = useCurrentUser();
  const { register, handleSubmit, reset, setValue, watch } = useForm<FormData>();

  useEffect(() => {
    if (user) reset({ full_name: user.full_name ?? '', is_developer: user.is_developer, is_qa: user.is_qa });
  }, [user, reset]);

  if (!user) return null;

  const onSave = async (data: FormData) => {
    const supabase = createClient();
    const { error } = await supabase.from('profiles').update(data).eq('id', user.id);
    if (error) {
      toast.error(mapSupabaseError(error).message);
    } else {
      toast.success('Profile updated');
    }
  };

  return (
    <div className="container mx-auto max-w-xl px-6 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Manage your profile.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSave)} className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user.email} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="full_name">Full name</Label>
              <Input id="full_name" {...register('full_name')} />
            </div>
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-start justify-between">
                <div>
                  <Label>I'm a developer</Label>
                  <p className="text-xs text-muted-foreground">Can be assigned tasks and bugs.</p>
                </div>
                <Switch
                  checked={watch('is_developer') ?? false}
                  onCheckedChange={(c) => setValue('is_developer', c)}
                />
              </div>
              <div className="flex items-start justify-between">
                <div>
                  <Label>I'm QA</Label>
                  <p className="text-xs text-muted-foreground">Can file bugs and triage.</p>
                </div>
                <Switch
                  checked={watch('is_qa') ?? false}
                  onCheckedChange={(c) => setValue('is_qa', c)}
                />
              </div>
            </div>
            <Button type="submit">Save</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
