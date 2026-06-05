import { serveCatalog } from '../catalogServe.js';

export async function onRequestGet(context) {
  return serveCatalog(context);
}
