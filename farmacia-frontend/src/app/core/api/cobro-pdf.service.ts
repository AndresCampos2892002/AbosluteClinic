// src/app/core/services/cobro-pdf.service.ts
import { Injectable } from '@angular/core';
import { CobroResponse, CobroItemDto, CobroPagoDto, CitaCajaVm } from '../api/caja-api.service';

// jsPDF se importa así después de: npm install jspdf
// Si da error de tipos: npm install --save-dev @types/jspdf
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface PdfData {
  cita:    CitaCajaVm;
  cobro:   CobroResponse;
  clinica: { nombre: string; telefono?: string; direccion?: string };
}

@Injectable({ providedIn: 'root' })
export class CobroPdfService {

  // ─── Generar PDF ──────────────────────────────────────────────────────────

  generarPdf(data: PdfData): jsPDF {
    const doc  = new jsPDF({ unit: 'mm', format: 'a4' });
    const { cita, cobro, clinica } = data;
    const margen = 20;
    let y = margen;

    // ── Encabezado de la clínica ────────────────────────────────────────────
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(clinica.nombre, margen, y);
    y += 7;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    if (clinica.telefono)  doc.text(`Tel: ${clinica.telefono}`,   margen, y);
    if (clinica.direccion) doc.text(clinica.direccion, margen, y + 4);
    y += clinica.direccion ? 12 : 7;
    doc.setTextColor(0);

    // ── Línea separadora ────────────────────────────────────────────────────
    doc.setDrawColor(220);
    doc.line(margen, y, 210 - margen, y);
    y += 8;

    // ── Título del recibo ───────────────────────────────────────────────────
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('RECIBO DE COBRO', margen, y);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(`#${cobro.idCobro} · Cita #${cita.idCita}`, 210 - margen, y, { align: 'right' });
    doc.setTextColor(0);
    y += 10;

    // ── Datos del paciente y cita ───────────────────────────────────────────
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('DATOS DE LA CITA', margen, y);
    y += 5;

    const fechaStr = new Date(cita.fechaInicio).toLocaleString('es-GT', {
      dateStyle: 'full', timeStyle: 'short',
    });

    const datosCita: [string, string][] = [
      ['Paciente',    cita.paciente],
      ['Teléfono',    cita.pacienteTel    ?? '—'],
      ['Correo',      cita.pacienteCorreo ?? '—'],
      ['Servicio',    cita.servicio],
      ['Especialista',cita.especialista   ?? '—'],
      ['Fecha',       fechaStr],
      ['Sucursal',    cita.sucursal],
      ['Estado cita', cita.estado],
    ];

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    for (const [k, v] of datosCita) {
      doc.setFont('helvetica', 'bold');
      doc.text(`${k}:`, margen, y);
      doc.setFont('helvetica', 'normal');
      doc.text(v, margen + 35, y);
      y += 5;
    }
    y += 4;

    // ── Tabla de servicios ──────────────────────────────────────────────────
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('SERVICIOS', margen, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      margin: { left: margen, right: margen },
      head: [['Servicio', 'Cant.', 'P/U', 'Subtotal']],
      body: cobro.items.map((i: CobroItemDto) => [
        i.nombre ?? `Servicio #${i.idServicio}`,
        String(i.cantidad),
        this.money(i.precioUnitario, cobro.moneda),
        this.money(i.subtotal,       cobro.moneda),
      ]),
      foot: [[
        { content: 'TOTAL', colSpan: 3, styles: { fontStyle: 'bold', halign: 'right' } },
        { content: this.money(cobro.total, cobro.moneda), styles: { fontStyle: 'bold' } },
      ]],
      headStyles:  { fillColor: [30, 30, 30], textColor: 255, fontSize: 9 },
      footStyles:  { fillColor: [240, 240, 240], textColor: 0, fontSize: 9 },
      bodyStyles:  { fontSize: 9 },
      alternateRowStyles: { fillColor: [250, 250, 250] },
    });

    y = (doc as any).lastAutoTable.finalY + 8;

    // ── Resumen de pago ─────────────────────────────────────────────────────
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('RESUMEN DE PAGO', margen, y);
    y += 3;

    const estadoColor: Record<string, [number, number, number]> = {
      PAGADO:   [34, 197, 94],
      PARCIAL:  [234, 179, 8],
      PENDIENTE:[239, 68, 68],
    };
    const color = estadoColor[cobro.estadoPago] ?? [100, 100, 100];

    autoTable(doc, {
      startY: y,
      margin: { left: margen, right: margen },
      body: [
        ['Total',   this.money(cobro.total,  cobro.moneda)],
        ['Pagado',  this.money(cobro.pagado, cobro.moneda)],
        ['Saldo',   this.money(cobro.saldo,  cobro.moneda)],
        ['Estado',  cobro.estadoPago],
      ],
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 40 },
        1: { halign: 'right' },
      },
      bodyStyles: { fontSize: 10 },
      didDrawCell: (hookData: any) => {
        // Colorear la celda de estado
        if (hookData.row.index === 3 && hookData.column.index === 1) {
          doc.setTextColor(...color);
        } else {
          doc.setTextColor(0);
        }
      },
    });

    y = (doc as any).lastAutoTable.finalY + 8;

    // ── Historial de abonos ─────────────────────────────────────────────────
    if (cobro.pagos.length > 0) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('HISTORIAL DE PAGOS', margen, y);
      y += 3;

      autoTable(doc, {
        startY: y,
        margin: { left: margen, right: margen },
        head: [['Fecha', 'Método', 'Referencia', 'Monto']],
        body: cobro.pagos.map((p: CobroPagoDto) => [
          new Date(p.fecha).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' }),
          p.metodo,
          p.referencia ?? '—',
          this.money(p.monto, cobro.moneda),
        ]),
        headStyles: { fillColor: [30, 30, 30], textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 9 },
      });

      y = (doc as any).lastAutoTable.finalY + 8;
    }

    // ── Pie de página ───────────────────────────────────────────────────────
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Generado el ${new Date().toLocaleString('es-GT')}`,
      105, 287, { align: 'center' },
    );
    doc.setTextColor(0);

    return doc;
  }

  // ─── Acciones de salida ───────────────────────────────────────────────────

  /** Descarga el PDF en el navegador */
  descargar(data: PdfData): void {
    const doc      = this.generarPdf(data);
    const filename = `cobro-cita-${data.cita.idCita}.pdf`;
    doc.save(filename);
  }

  /** Abre el PDF en una nueva pestaña para impresión */
  imprimir(data: PdfData): void {
    const doc  = this.generarPdf(data);
    const blob = doc.output('blob');
    const url  = URL.createObjectURL(blob);
    const win  = window.open(url, '_blank');
    win?.addEventListener('load', () => {
      win.print();
      URL.revokeObjectURL(url);
    });
  }

  /**
   * Envía el resumen por WhatsApp al paciente.
   * Abre wa.me con un mensaje de texto — WhatsApp Web no soporta
   * adjuntar PDFs directamente, pero puedes descargarlo primero y
   * luego adjuntarlo manualmente desde el chat.
   */
  enviarWhatsApp(data: PdfData): void {
    const { cita, cobro } = data;
    const tel = cita.pacienteTel?.replace(/\D/g, '');

    if (!tel) {
      alert('El paciente no tiene teléfono registrado.');
      return;
    }

    // Primero descargamos el PDF para que el usuario lo adjunte
    this.descargar(data);

    // Luego abrimos WhatsApp con el resumen en texto
    const msg = [
      `Hola ${cita.paciente}, adjunto el resumen de su cita en ${data.clinica.nombre}.`,
      ``,
      `📅 Cita #${cita.idCita}`,
      `🗓 ${new Date(cita.fechaInicio).toLocaleString('es-GT', { dateStyle: 'long', timeStyle: 'short' })}`,
      `💆 Servicio: ${cita.servicio}`,
      ``,
      `💰 Total:  ${this.money(cobro.total,  cobro.moneda)}`,
      `✅ Pagado: ${this.money(cobro.pagado, cobro.moneda)}`,
      `🔄 Saldo:  ${this.money(cobro.saldo,  cobro.moneda)}`,
      ``,
      `(El PDF del recibo fue descargado en su dispositivo)`,
    ].join('\n');

    const url = `https://wa.me/502${tel}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  }

  /**
   * Abre el cliente de correo del sistema con el resumen en el cuerpo.
   * Para envío real con adjunto necesitarías un endpoint en el backend.
   */
  enviarCorreo(data: PdfData): void {
    const { cita, cobro } = data;

    if (!cita.pacienteCorreo) {
      alert('El paciente no tiene correo registrado.');
      return;
    }

    // Descargamos el PDF primero para que lo adjunten manualmente
    this.descargar(data);

    const subject = encodeURIComponent(
      `Recibo de cita #${cita.idCita} - ${data.clinica.nombre}`
    );

    const body = encodeURIComponent([
      `Estimado/a ${cita.paciente},`,
      ``,
      `Adjunto encontrará el recibo de su cita del ${new Date(cita.fechaInicio).toLocaleDateString('es-GT')}.`,
      ``,
      `Resumen:`,
      `  Servicio: ${cita.servicio}`,
      `  Total:    ${this.money(cobro.total,  cobro.moneda)}`,
      `  Pagado:   ${this.money(cobro.pagado, cobro.moneda)}`,
      `  Saldo:    ${this.money(cobro.saldo,  cobro.moneda)}`,
      `  Estado:   ${cobro.estadoPago}`,
      ``,
      `(El PDF del recibo fue descargado — adjúntelo manualmente a este correo)`,
      ``,
      `Saludos,`,
      `${data.clinica.nombre}`,
    ].join('\n'));

    window.location.href = `mailto:${cita.pacienteCorreo}?subject=${subject}&body=${body}`;
  }

  // ─── Helper ───────────────────────────────────────────────────────────────

  private money(v: number | null | undefined, moneda = 'GTQ'): string {
    if (v == null) return `${moneda} 0.00`;
    return `${moneda} ${Number(v).toFixed(2)}`;
  }
}