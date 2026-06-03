import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { baseApi } from './baseApi';
import { listenerMiddleware } from './listenerMiddleware';
import { kanbanReducer } from '@/features/tasks/kanbanSlice';
import { authReducer } from '@/features/auth/authSlice';

// Side-effect imports — each feature module injects endpoints into baseApi.
// Importing them here at store boot ensures the endpoints are registered.
import '@/features/workspaces/workspaceApi';
import '@/features/boards/boardApi';
import '@/features/tasks/taskApi';
import '@/features/tasks/subtaskApi';
import '@/features/comments/commentApi';
import '@/features/bugs/bugApi';
import '@/features/notifications/notificationApi';
import '@/features/invitations/invitationApi';

export const makeStore = () => {
  const store = configureStore({
    reducer: {
      [baseApi.reducerPath]: baseApi.reducer,
      kanban: kanbanReducer,
      auth: authReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware()
        .prepend(listenerMiddleware.middleware)
        .concat(baseApi.middleware),
  });
  setupListeners(store.dispatch);
  return store;
};

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
