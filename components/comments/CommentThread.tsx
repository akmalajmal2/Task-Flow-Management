'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { useConfirm } from '@/components/shared/ConfirmDialog';
import {
  useCreateCommentMutation,
  useDeleteCommentMutation,
  useListCommentsQuery,
} from '@/features/comments/commentApi';
import { useCommentsRealtime } from '@/hooks/useRealtime';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { relativeTime } from '@/lib/utils/dates';
import type { CommentParentType } from '@/types/domain';

interface Props {
  parentType: CommentParentType;
  parentId: string;
}

export function CommentThread({ parentType, parentId }: Props) {
  useCommentsRealtime(parentType, parentId);
  const { user } = useCurrentUser();
  const confirm = useConfirm();
  const { data: comments = [] } = useListCommentsQuery({ parentType, parentId });
  const [create, { isLoading: creating }] = useCreateCommentMutation();
  const [deleteComment] = useDeleteCommentMutation();
  const [body, setBody] = useState('');

  const onSubmit = async () => {
    if (!body.trim()) return;
    try {
      await create({
        parentType,
        parentId,
        body: body.trim(),
        bodyJson: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: body.trim() }] }] },
      }).unwrap();
      setBody('');
    } catch {
      /* toasted */
    }
  };

  const onDelete = async (commentId: string) => {
    const ok = await confirm({
      title: 'Delete comment?',
      destructive: true,
      confirmText: 'Delete',
    });
    if (!ok) return;
    await deleteComment({ commentId, parentType, parentId }).unwrap();
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Comments ({comments.length})</h3>
      <div className="space-y-3">
        {comments.map((c) => (
          <div key={c.id} className="flex gap-2">
            <UserAvatar
              name={c.author?.full_name}
              src={c.author?.avatar_url}
              className="h-7 w-7 shrink-0"
            />
            <div className="min-w-0 flex-1 rounded-md border bg-muted/30 px-3 py-2">
              <div className="flex items-baseline justify-between">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium">{c.author?.full_name ?? 'User'}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {relativeTime(c.created_at)}
                  </span>
                </div>
                {c.author_id === user?.id && (
                  <button
                    onClick={() => onDelete(c.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm">{c.body}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Textarea
          rows={2}
          placeholder="Write a comment…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onSubmit();
          }}
        />
        <Button onClick={onSubmit} disabled={creating || !body.trim()}>
          Send
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">⌘/Ctrl + Enter to send</p>
    </div>
  );
}
