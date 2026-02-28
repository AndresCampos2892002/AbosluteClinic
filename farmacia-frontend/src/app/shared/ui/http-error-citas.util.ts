// src/app/shared/ui/http-error-citas.util.ts
import { HttpErrorResponse } from '@angular/common/http';
import { httpErrorMessage } from './http-error.util';

type AnyObj = Record<string, any>;

export function httpErrorCitasMessage(
  err: unknown,
  fallback = 'No se pudo completar la operación de Citas.'
): string {
  const e = err as any;
  const status: number = typeof e?.status === 'number' ? e.status : -1;

  // 0 = no hubo respuesta HTTP (CORS, backend apagado, DNS, etc.)
  if (status === 0) {
    return 'No se pudo conectar al servidor. Verifica que el backend esté encendido y CORS configurado.';
  }

  const body = (e as HttpErrorResponse)?.error;

  // Texto plano
  let plainText = '';
  if (typeof body === 'string' && body.trim()) {
    plainText = body.trim();
    if (plainText.toLowerCase().includes('<html')) {
      // evita HTML feo
      return msgByStatusCitas(status, fallback);
    }
  }

  // Blob
  if (typeof Blob !== 'undefined' && body instanceof Blob) {
    return msgByStatusCitas(status, fallback);
  }

  // JSON
  const json: AnyObj | null = (body && typeof body === 'object') ? (body as AnyObj) : null;

  const serverCode =
    json?.['code'] ??
    json?.['errorCode'] ??
    json?.['codigo'] ??
    json?.['type'] ??
    null;

  const serverMsg =
    json?.['message'] ??
    json?.['msg'] ??
    json?.['detail'] ??
    json?.['error_description'] ??
    json?.['error'] ??
    null;

  // Validaciones: { errors: [{ field, message }, ...] } (Spring Validation u otros)
  const errors = json?.['errors'];
  if (Array.isArray(errors) && errors.length) {
    const first = errors[0] as AnyObj;
    const fieldRaw = String(first?.['field'] ?? '').trim();
    const msg =
      first?.['message'] ||
      first?.['defaultMessage'] ||
      first?.['msg'] ||
      null;

    if (msg) {
      const field = prettifyField(fieldRaw);
      return field ? `${field}: ${String(msg)}` : String(msg);
    }
  }

  // Construimos un "raw" para detectar patrones
  const rawLower = buildRawLower({
    status,
    serverCode,
    serverMsg,
    plainText,
    json,
  });

  // =========================
  // Citas: errores específicos
  // =========================

  // 1) Conflicto de horario / solapamiento
  if (status === 409 || looksLikeOverlap(rawLower)) {
    return 'Ese horario ya está ocupado. Elige otra hora, duración o especialista.';
  }

  // 2) Fecha/hora inválida (pasado)
  if (looksLikePastDate(rawLower)) {
    return 'No puedes agendar una cita en el pasado. Ajusta fecha y hora.';
  }

  // 3) Duración inválida
  if (looksLikeBadDuration(rawLower)) {
    return 'Duración inválida. Usa un valor entre 5 y 210 minutos.';
  }

  // 4) TERMINADA sin tipo de pago
  if (looksLikeMissingCobroType(rawLower)) {
    return 'Para marcar como TERMINADA debes seleccionar el tipo de pago (Pago inmediato o Cuenta por cobrar).';
  }

  // 5) Recursos no encontrados
  if (looksLikeNotFoundPaciente(rawLower)) {
    return 'El paciente seleccionado no existe o fue eliminado.';
  }
  if (looksLikeNotFoundServicio(rawLower)) {
    return 'El servicio seleccionado no existe o fue eliminado.';
  }
  if (looksLikeNotFoundSucursal(rawLower)) {
    return 'La sucursal seleccionada no existe o ya no está disponible.';
  }
  if (looksLikeNotFoundEspecialista(rawLower)) {
    return 'El especialista seleccionado no existe o ya no está disponible.';
  }

  // 6) Reglas de estado / transición
  if (looksLikeCannotCancel(rawLower)) {
    return 'No se puede cancelar esta cita por su estado actual.';
  }
  if (looksLikeInvalidStatusChange(rawLower)) {
    return 'No se puede cambiar el estado de la cita en este momento.';
  }

  // 7) Cobro ya cerrado / ya pagado
  if (looksLikeCobroClosed(rawLower)) {
    return 'El cobro de esta cita ya fue cerrado o pagado. Revisa el detalle en Caja.';
  }

  // 8) Permisos con mensaje más "citas"
  if (status === 403) {
    return 'No tienes permisos para gestionar citas. Revisa tu rol o inicia sesión con un usuario autorizado.';
  }

  // Si el backend mandó un mensaje usable, úsalo
  if (serverMsg && String(serverMsg).trim()) {
    return String(serverMsg).trim();
  }
  if (plainText) {
    return plainText;
  }

  // fallback genérico
  return httpErrorMessage(err, fallback);
}

/* =========================
   Helpers
========================= */

function msgByStatusCitas(status: number, fallback: string): string {
  switch (status) {
    case 400: return 'Solicitud inválida. Revisa los datos de la cita.';
    case 401: return 'Tu sesión expiró o no estás autenticado. Inicia sesión nuevamente.';
    case 403: return 'No tienes permisos para gestionar citas.';
    case 404: return 'No se encontró el recurso de citas (endpoint/ruta incorrecta).';
    case 409: return 'Conflicto: ya existe una cita en ese horario o hay un choque de agenda.';
    case 422: return 'Datos inválidos. Revisa campos requeridos y formato.';
    case 500: return 'Error interno del servidor en Citas. Revisa el backend.';
    default:  return fallback || `Error inesperado (${status})`;
  }
}

function buildRawLower(input: {
  status: number;
  serverCode: any;
  serverMsg: any;
  plainText: string;
  json: AnyObj | null;
}): string {
  const { status, serverCode, serverMsg, plainText, json } = input;

  let safeJson = '';
  try {
    safeJson = JSON.stringify(json || {}).toLowerCase();
  } catch {
    safeJson = '';
  }

  return [
    String(status),
    String(serverCode ?? ''),
    String(serverMsg ?? ''),
    String(plainText ?? ''),
    safeJson,
  ].join(' ').toLowerCase();
}

function prettifyField(field: string): string {
  if (!field) return '';

  const map: Record<string, string> = {
    idSucursal: 'Sucursal',
    id_sucursal: 'Sucursal',

    idPaciente: 'Paciente',
    id_paciente: 'Paciente',

    idServicio: 'Servicio',
    id_servicio: 'Servicio',

    idEspecialista: 'Especialista',
    id_especialista: 'Especialista',

    fechaInicio: 'Fecha/Hora',
    fecha_inicio: 'Fecha/Hora',
    fecha: 'Fecha',
    hora: 'Hora',

    duracionMinutos: 'Duración',
    duracion_minutos: 'Duración',

    estado: 'Estado',
    canal: 'Canal',

    cancelacionCobro: 'Tipo de pago',
    cancelacion_cobro: 'Tipo de pago',
  };

  return map[field] ?? field;
}

/* =========================
   Pattern detectors
========================= */

function looksLikeOverlap(raw: string): boolean {
  return (
    raw.includes('solap') ||
    raw.includes('overlap') ||
    raw.includes('horario ocupado') ||
    raw.includes('agenda ocupada') ||
    raw.includes('conflicto de horario') ||
    raw.includes('already booked') ||
    raw.includes('time slot') && raw.includes('busy') ||
    raw.includes('cita en ese horario')
  );
}

function looksLikePastDate(raw: string): boolean {
  return (
    raw.includes('en el pasado') ||
    raw.includes('fecha en el pasado') ||
    raw.includes('in the past') ||
    raw.includes('must be after') ||
    raw.includes('before now') ||
    raw.includes('fecha_inicio') && raw.includes('past')
  );
}

function looksLikeBadDuration(raw: string): boolean {
  return (
    raw.includes('duracion') && (raw.includes('max') || raw.includes('min') || raw.includes('invalid')) ||
    raw.includes('duration') && (raw.includes('max') || raw.includes('min') || raw.includes('invalid')) ||
    raw.includes('duracionminutos') && (raw.includes('must be') || raw.includes('greater') || raw.includes('less'))
  );
}

function looksLikeMissingCobroType(raw: string): boolean {
  return (
    raw.includes('cancelacioncobro') && (raw.includes('required') || raw.includes('obligatorio') || raw.includes('null')) ||
    raw.includes('tipo de pago') && (raw.includes('requerido') || raw.includes('obligatorio')) ||
    raw.includes('terminada') && raw.includes('pago') && (raw.includes('required') || raw.includes('obligatorio'))
  );
}

function looksLikeNotFoundPaciente(raw: string): boolean {
  return raw.includes('paciente') && (raw.includes('not found') || raw.includes('no encontrado') || raw.includes('does not exist'));
}
function looksLikeNotFoundServicio(raw: string): boolean {
  return raw.includes('servicio') && (raw.includes('not found') || raw.includes('no encontrado') || raw.includes('does not exist'));
}
function looksLikeNotFoundSucursal(raw: string): boolean {
  return raw.includes('sucursal') && (raw.includes('not found') || raw.includes('no encontrado') || raw.includes('does not exist'));
}
function looksLikeNotFoundEspecialista(raw: string): boolean {
  return raw.includes('especialista') && (raw.includes('not found') || raw.includes('no encontrado') || raw.includes('does not exist'));
}

function looksLikeCannotCancel(raw: string): boolean {
  return (
    raw.includes('no se puede cancelar') ||
    (raw.includes('cancel') && raw.includes('not allowed')) ||
    (raw.includes('cancelar') && raw.includes('estado'))
  );
}

function looksLikeInvalidStatusChange(raw: string): boolean {
  return (
    raw.includes('cambiar estado') && (raw.includes('no permitido') || raw.includes('not allowed')) ||
    raw.includes('invalid state') ||
    raw.includes('transicion') && raw.includes('estado')
  );
}

function looksLikeCobroClosed(raw: string): boolean {
  return (
    raw.includes('cobro') && (raw.includes('cerrado') || raw.includes('closed') || raw.includes('finalizado')) ||
    raw.includes('ya pagado') ||
    raw.includes('already paid')
  );
}
