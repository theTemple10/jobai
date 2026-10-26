export const MODULE_LOAD_MESSAGE = 'A required part of RoleAide could not load. Check your connection, save any work you want to keep, then reload the page and choose your file again.';

export function isModuleLoadError(error) {
  return /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|failed to load module script/i.test(error?.message || '');
}
