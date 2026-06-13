// Grade cu acces extins
export const CAN_MANAGE = ['Adjunct PR', 'Manager PR', 'Supervizor PR', 'Conducere Spital'];
// Whitelist, editare membri, anunturi, postare evenimente
export const CAN_EDIT   = ['Adjunct PR', 'Manager PR', 'Supervizor PR', 'Conducere Spital'];

export function canManage(rank) {
  return CAN_MANAGE.includes(rank);
}
export function canEdit(rank) {
  return CAN_EDIT.includes(rank);
}
