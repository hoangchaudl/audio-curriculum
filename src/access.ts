import { Category, Module, Role, User } from './types';

// Engineers review every trainee and admins manage the curriculum, so only
// sound designers are ever subject to category locks.
export const seesAllCategories = (role?: Role) => role === 'audio_engineer' || role === 'admin';

// A module whose category no longer exists is treated as unrestricted, so
// deleting or mistyping a category can never hide content by accident.
export const isRestrictedCategory = (categories: Category[], categoryId?: string) =>
  !!categoryId && categories.some(c => c.id === categoryId && c.restricted);

export const canSeeModule = (mod: Module, categories: Category[], user: User | null, role?: Role) =>
  seesAllCategories(role ?? user?.role) ||
  !isRestrictedCategory(categories, mod.category) ||
  !!(mod.category && user?.unlockedCategories?.includes(mod.category));

export const sortCategories = (categories: Category[]) => [...categories].sort((a, b) => a.order - b.order);
