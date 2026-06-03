import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Profile } from '@/types/domain';

interface AuthState {
  user: Profile | null;
  initialized: boolean;
}

const initialState: AuthState = {
  user: null,
  initialized: false,
};

const slice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<Profile | null>) {
      state.user = action.payload;
      state.initialized = true;
    },
    clearUser(state) {
      state.user = null;
      state.initialized = true;
    },
  },
});

export const { setUser, clearUser } = slice.actions;
export const authReducer = slice.reducer;
