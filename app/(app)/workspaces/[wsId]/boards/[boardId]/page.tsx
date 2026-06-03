'use client';

import { useParams } from 'next/navigation';
import { Board } from '@/components/kanban/Board';
import { TaskForm } from '@/components/tasks/TaskForm';
import { TaskDetailDrawer } from '@/components/tasks/TaskDetailDrawer';
import { useGetBoardQuery } from '@/features/boards/boardApi';
import { useAppDispatch, useAppSelector } from '@/hooks/useAppStore';
import { setSelectedTask } from '@/features/tasks/kanbanSlice';
import { useBoardPermissions } from '@/hooks/usePermissions';
import { Lock, Globe } from 'lucide-react';

export default function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const { data: board } = useGetBoardQuery({ boardId });
  const dispatch = useAppDispatch();
  const selectedTaskId = useAppSelector((s) => s.kanban.selectedTaskId);
  const perms = useBoardPermissions(boardId);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b bg-background px-4 py-3">
        <div className="flex items-center gap-3">
          {board && (
            <span
              className="h-4 w-4 shrink-0 rounded-sm"
              style={{ backgroundColor: board.color }}
            />
          )}
          <h1 className="text-lg font-semibold">{board?.name ?? 'Board'}</h1>
          {board && (
            <span className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">
              {board.visibility === 'private' ? (
                <Lock className="h-3 w-3" />
              ) : (
                <Globe className="h-3 w-3" />
              )}
              {board.visibility}
            </span>
          )}
        </div>
        {perms.canCreateTask && <TaskForm boardId={boardId} />}
      </div>

      <div className="flex-1 overflow-hidden">
        <Board boardId={boardId} />
      </div>

      <TaskDetailDrawer
        boardId={boardId}
        taskId={selectedTaskId}
        onClose={() => dispatch(setSelectedTask(null))}
      />
    </div>
  );
}
