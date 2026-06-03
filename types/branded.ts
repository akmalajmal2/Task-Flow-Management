/**
 * Branded ID types — compile-time prevention of mixing up entity IDs.
 *
 *   const wsId: WorkspaceId = 'abc' as WorkspaceId;
 *   doSomethingWithBoard(wsId); // ❌ Type error: Argument of type 'WorkspaceId' is not assignable to parameter of type 'BoardId'
 *
 * Cast at the boundary (database response, URL param) and stay typed
 * everywhere else.
 */
declare const __brand: unique symbol;
export type Brand<T, B> = T & { readonly [__brand]: B };

export type UserId = Brand<string, 'UserId'>;
export type WorkspaceId = Brand<string, 'WorkspaceId'>;
export type BoardId = Brand<string, 'BoardId'>;
export type ColumnId = Brand<string, 'ColumnId'>;
export type TaskId = Brand<string, 'TaskId'>;
export type SubtaskId = Brand<string, 'SubtaskId'>;
export type BugId = Brand<string, 'BugId'>;
export type CommentId = Brand<string, 'CommentId'>;
export type LabelId = Brand<string, 'LabelId'>;
export type InvitationId = Brand<string, 'InvitationId'>;
export type NotificationId = Brand<string, 'NotificationId'>;

export const asUserId = (s: string) => s as UserId;
export const asWorkspaceId = (s: string) => s as WorkspaceId;
export const asBoardId = (s: string) => s as BoardId;
export const asColumnId = (s: string) => s as ColumnId;
export const asTaskId = (s: string) => s as TaskId;
