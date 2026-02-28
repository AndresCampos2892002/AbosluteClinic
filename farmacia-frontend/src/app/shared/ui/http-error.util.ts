// src/app/shared/utils/http-error.util.ts
import { HttpErrorResponse } from '@angular/common/http';

type AnyObj = Record<string, any>;

export function httpErrorMessage(err: unknown, fallback = 'Ocurrió un error'): string {
  const e = err as any;
  const status: number = typeof e?.status === 'number' ? e.status : -1;

  // 0 = no hubo respuesta HTTP (CORS, backend apagado, DNS, etc.)
  if (status === 0) {
    return 'No se pudo conectar al servidor. Verifica que el backend esté encendido y que CORS esté configurado.';
  }

  // Angular suele mandar HttpErrorResponse
  const body = (e as HttpErrorResponse)?.error;

  // Si el backend mandó texto plano
  if (typeof body === 'string' && body.trim()) {
    const txt = body.trim();
    // evita mostrar HTML feo
    if (txt.toLowerCase().includes('<html')) return msgByStatus(status, fallback);
    return txt;
  }

  // Si el backend mandó Blob (pasa cuando el Content-Type viene raro)
  if (typeof Blob !== 'undefined' && body instanceof Blob) {
    return msgByStatus(status, fallback);
  }

  // JSON típico (Spring / tu API)
  const json: AnyObj | null = (body && typeof body === 'object') ? (body as AnyObj) : null;

  // 1) Mensajes comunes (tu API y Spring)
  const serverMsg =
    json?.['message'] ??
    json?.['msg'] ??
    json?.['detail'] ??
    json?.['error_description'] ??
    json?.['error'] ??
    null;

  // 2) Validaciones con lista de errores (Spring Validation)
  // { errors: [{ field, message }, ...] } o variantes
  const errors = json?.['errors'];
  if (Array.isArray(errors) && errors.length) {
    const first = errors[0] as AnyObj;
    const field = first?.['field'] ? `${first['field']}: ` : '';
    const msg = first?.['message'] || first?.['defaultMessage'] || first?.['msg'];
    if (msg) return `${field}${String(msg)}`;
  }

  // 3) Duplicados / unique constraint
  const raw = safeLowerJson(json);

  // Si el backend ya lo manda como 409
  if (status === 409) {
    return 'Ya existe un registro similar.';
  }

  // A veces llega como 500/400 pero en texto dice duplicate/unique
  if ((status === 500 || status === 400) && looksLikeDuplicate(raw)) {
    return 'Ya existe un servicio similar.';
  }

  // 4) Si el backend mandó un mensaje usable
  if (serverMsg && String(serverMsg).trim()) {
    return String(serverMsg).trim();
  }

  // 5) Si no hay nada, mapeo por status
  return msgByStatus(status, fallback);
}

function msgByStatus(status: number, fallback: string): string {
  switch (status) {
    case 400: return 'Solicitud inválida. Revisa los datos enviados.';
    case 401: return 'Tu sesión expiró o no estás autenticado. Inicia sesión nuevamente.';
    case 403: return 'No tienes permisos para realizar esta acción.';
    case 404: return 'No se encontró el recurso (ruta incorrecta o endpoint no existe).';
    case 405: return 'Método no permitido (revisa GET/POST/PUT y la ruta).';
    case 408: return 'Tiempo de espera agotado. Intenta de nuevo.';
    case 409: return 'Conflicto: el registro ya existe o hay datos duplicados.';
    case 413: return 'El contenido enviado es demasiado grande.';
    case 415: return 'Formato no soportado (Content-Type incorrecto).';
    case 422: return 'Datos inválidos. Revisa campos requeridos y formato.';
    case 429: return 'Demasiadas solicitudes. Intenta de nuevo en unos segundos.';
    case 500: return 'Error interno del servidor. Revisa el backend.';
    case 502: return 'Error de gateway/proxy. Backend no respondió correctamente.';
    case 503: return 'Servicio no disponible. Backend en mantenimiento o caído.';
    case 504: return 'El servidor tardó demasiado en responder.';
    default:  return fallback || `Error inesperado (${status})`;
  }
}

function safeLowerJson(json: AnyObj | null): string {
  try {
    return JSON.stringify(json || {}).toLowerCase();
  } catch {
    return '';
  }
}

function looksLikeDuplicate(rawLowerJson: string): boolean {
  return (
    rawLowerJson.includes('llave duplicada') ||
    rawLowerJson.includes('duplicate key') ||
    rawLowerJson.includes('unique') ||
    rawLowerJson.includes('violates unique constraint') ||
    rawLowerJson.includes('violates constraint') ||
    (rawLowerJson.includes('constraint') && rawLowerJson.includes('unique'))
  );
}
