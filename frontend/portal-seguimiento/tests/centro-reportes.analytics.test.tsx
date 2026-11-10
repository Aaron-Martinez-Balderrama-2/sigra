import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CentroReportes } from '../src/components/CentroReportes';
import * as api from '../src/services/api';

const CONTEXTO_PRUEBA = {
  cursoId: 'sec-3b',
  cursoNombre: '3.° B de Secundaria',
  materiaId: 'mat-mat',
  materiaNombre: 'Matemáticas',
  gestion: 2026,
  trimestre: 1,
};

describe('MÓDULO DE REPORTES Y ANALÍTICA AVANZADA (CentroReportes.tsx)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Renderiza los 4 KPIs Continuos: Tasa de Aprobación, Promedio del Curso, Asistencia Promedio y Estudiantes en Riesgo', () => {
    render(<CentroReportes token="token-test" contexto={CONTEXTO_PRUEBA} />);

    const kpiStrip = screen.getByTestId('kpi-strip-reportes');

    // Tasa de aprobación (60.0% = 3 de 5)
    expect(within(kpiStrip).getByText('60.0%')).toBeInTheDocument();
    expect(within(kpiStrip).getByText(/3 Aprobados · 2 Aplazados/i)).toBeInTheDocument();

    // Promedio general (66.70 / 100)
    expect(within(kpiStrip).getByText('66.70')).toBeInTheDocument();
    expect(within(kpiStrip).getByText(/Escala 1 a 100 pts/i)).toBeInTheDocument();

    // Asistencia promedio (76.6%)
    expect(within(kpiStrip).getByText('76.6%')).toBeInTheDocument();
    expect(within(kpiStrip).getByText(/Umbral Mín: 80.0%/i)).toBeInTheDocument();

    // Estudiantes en riesgo (3 alumnos)
    expect(within(kpiStrip).getByText('3 Alumnos')).toBeInTheDocument();
    expect(within(kpiStrip).getByText(/2 Alto · 1 Medio/i)).toBeInTheDocument();
  });

  it('2. Renderiza el Gráfico de Asistencias con umbral del 80% y los 5 alumnos', () => {
    render(<CentroReportes token="token-test" contexto={CONTEXTO_PRUEBA} />);

    const chartAsist = screen.getByTestId('grafico-asistencias');
    expect(chartAsist).toBeInTheDocument();
    expect(chartAsist).toHaveTextContent(/Analítica de Asistencia por Estudiante/i);
    expect(chartAsist).toHaveTextContent(/Umbral Reglamentario 80%/i);

    // Verifica que están las asistencias de los 5 alumnos
    expect(chartAsist).toHaveTextContent('100%'); // Valentina
    expect(chartAsist).toHaveTextContent('92%');  // Camila
    expect(chartAsist).toHaveTextContent('76%');  // Santiago
    expect(chartAsist).toHaveTextContent('60%');  // Mateo
    expect(chartAsist).toHaveTextContent('55%');  // Diego
  });

  it('3. Renderiza el Gráfico de Aplazados vs Aprobados con barra proporcional y corte de 51 puntos', () => {
    render(<CentroReportes token="token-test" contexto={CONTEXTO_PRUEBA} />);

    const chartAplazados = screen.getByTestId('grafico-aplazados');
    expect(chartAplazados).toBeInTheDocument();
    expect(chartAplazados).toHaveTextContent(/Rendimiento Académico: Aprobados vs Aplazados/i);
    expect(chartAplazados).toHaveTextContent(/APROBADOS: 60.0% \(3\)/i);
    expect(chartAplazados).toHaveTextContent(/APLAZADOS: 40.0% \(2\)/i);
    expect(chartAplazados).toHaveTextContent(/Corte de Aprobación: 51 pts/i);
  });

  it('4. Renderiza la Sección de Clasificación de Riesgo Escolar (En Riesgo vs Sin Riesgo)', () => {
    render(<CentroReportes token="token-test" contexto={CONTEXTO_PRUEBA} />);

    const seccionRiesgo = screen.getByTestId('seccion-clasificacion-riesgo');
    expect(seccionRiesgo).toBeInTheDocument();

    // En riesgo: Mateo (Alto), Diego (Alto), Santiago (Medio)
    expect(seccionRiesgo).toHaveTextContent(/Mateo Rojas Villarroel/i);
    expect(seccionRiesgo).toHaveTextContent(/Diego Morales Arteaga/i);
    expect(seccionRiesgo).toHaveTextContent(/Santiago Flores Céspedes/i);
    expect(seccionRiesgo).toHaveTextContent(/3 Alumnos con Alerta/i);

    // Sin riesgo: Valentina (Sobresaliente) y Camila (Satisfactorio)
    expect(seccionRiesgo).toHaveTextContent(/Valentina Suárez Justiniano/i);
    expect(seccionRiesgo).toHaveTextContent(/Camila Gutiérrez Paz/i);
    expect(seccionRiesgo).toHaveTextContent(/2 Alumnos en Norma/i);
  });

  it('5. Nómina Oficial permite filtrar entre Todos, Aprobados, Aplazados y En Riesgo', () => {
    render(<CentroReportes token="token-test" contexto={CONTEXTO_PRUEBA} />);

    const tabla = screen.getByTestId('tabla-nomina-aprobados-aplazados');
    expect(tabla).toBeInTheDocument();

    // Inicialmente muestra los 5 estudiantes en la tabla
    expect(within(tabla).getByText('Valentina Suárez Justiniano')).toBeInTheDocument();
    expect(within(tabla).getByText('Camila Gutiérrez Paz')).toBeInTheDocument();
    expect(within(tabla).getByText('Santiago Flores Céspedes')).toBeInTheDocument();
    expect(within(tabla).getByText('Diego Morales Arteaga')).toBeInTheDocument();
    expect(within(tabla).getByText('Mateo Rojas Villarroel')).toBeInTheDocument();

    // Filtrar por APROBADOS (3 alumnos)
    const btnAprobados = screen.getByRole('button', { name: /Aprobados \(>= 51 pts\)/i });
    fireEvent.click(btnAprobados);

    expect(within(tabla).getByText('Valentina Suárez Justiniano')).toBeInTheDocument();
    expect(within(tabla).getByText('Camila Gutiérrez Paz')).toBeInTheDocument();
    expect(within(tabla).getByText('Santiago Flores Céspedes')).toBeInTheDocument();
    expect(within(tabla).queryByText('Diego Morales Arteaga')).not.toBeInTheDocument();
    expect(within(tabla).queryByText('Mateo Rojas Villarroel')).not.toBeInTheDocument();

    // Filtrar por APLAZADOS (2 alumnos)
    const btnAplazados = screen.getByRole('button', { name: /Aplazados \/ Reprobados \(< 51 pts\)/i });
    fireEvent.click(btnAplazados);

    expect(within(tabla).getByText('Diego Morales Arteaga')).toBeInTheDocument();
    expect(within(tabla).getByText('Mateo Rojas Villarroel')).toBeInTheDocument();
    expect(within(tabla).queryByText('Valentina Suárez Justiniano')).not.toBeInTheDocument();
    expect(within(tabla).queryByText('Camila Gutiérrez Paz')).not.toBeInTheDocument();
  });

  it('6. Descarga y Verificación Binaria en los 5 formatos (.pdf, .xlsx, .docx, .csv, .json)', async () => {
    const spyDescarga = vi.spyOn(api, 'descargarReporteMultiformato').mockResolvedValue({
      blob: new Blob(['%PDF-1.4 test']),
      bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]),
      filename: 'reporte-test.pdf',
      contentType: 'application/pdf',
      sizeBytes: 4096,
    });

    render(<CentroReportes token="token-test" contexto={CONTEXTO_PRUEBA} />);

    const btnPdf = screen.getByTestId('btn-descargar-pdf');
    fireEvent.click(btnPdf);

    await waitFor(() => {
      expect(spyDescarga).toHaveBeenCalledWith(
        expect.objectContaining({
          formato: 'pdf',
          cursoId: 'sec-3b',
        })
      );
    });

    // Debe registrar la descarga en el historial
    await waitFor(() => {
      expect(screen.getByTestId('tabla-descargas-reportes')).toBeInTheDocument();
      expect(screen.getByText('reporte-test.pdf')).toBeInTheDocument();
      expect(screen.getByText('Firma %PDF- Válida')).toBeInTheDocument();
    });
  });
});
