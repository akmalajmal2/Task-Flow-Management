import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type BoardView = 'kanban' | 'list';

interface KanbanState {
  selectedTaskId: string | null;
  boardView: BoardView;
  /** Per-board filters (assignee, label, priority). Keyed by board ID. */
  filters: Record<
    string,
    {
      assigneeId?: string;
      labelId?: string;
      priority?: string;
      search?: string;
    }
  >;
}

const initialState: KanbanState = {
  selectedTaskId: null,
  boardView: 'kanban',
  filters: {},
};

const slice = createSlice({
  name: 'kanban',
  initialState,
  reducers: {
    setSelectedTask(state, action: PayloadAction<string | null>) {
      state.selectedTaskId = action.payload;
    },
    setBoardView(state, action: PayloadAction<BoardView>) {
      state.boardView = action.payload;
    },
    setFilter(
      state,
      action: PayloadAction<{
        boardId: string;
        filter: Partial<KanbanState['filters'][string]>;
      }>
    ) {
      const { boardId, filter } = action.payload;
      state.filters[boardId] = { ...(state.filters[boardId] ?? {}), ...filter };
    },
    clearFilter(state, action: PayloadAction<{ boardId: string }>) {
      delete state.filters[action.payload.boardId];
    },
  },
});

export const { setSelectedTask, setBoardView, setFilter, clearFilter } = slice.actions;
export const kanbanReducer = slice.reducer;
