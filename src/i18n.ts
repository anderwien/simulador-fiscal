export type Lang = 'es' | 'en';

export interface Translations {
  appTitle: string;
  toggleAnual: string;
  toggleMensual: string;
  bruto: string;
  neto: string;
  segSocial: string;
  irpfMedio: string;
  exportar: string;
  importar: string;
  importError: string;

  perfilPersonalTitle: string;
  comAutonoma: string;
  estadoCivil: string;
  estadoCivilOptions: { soltero: string; casado_indiv: string; casado_conjunta: string };
  hijosACargo: string;
  hijosOptions: { ninguno: string; masDe4: string };
  minimoPersonalExento: (amount: string) => string;

  ingresosTitle: string;
  anadir: string;
  nombrePlaceholder: string;
  cuentaAjena: string;
  freelance: string;
  periodMensual: string;
  periodAnual: string;
  ingresoLabel: string;
  gastosDeduciblesLabel: string;
  defaultIncomeName: string;
  nuevoIngreso: string;

  cuotaAutonomoTitle: string;
  eurMesSegSocial: string;
  calculadoSegunTramo: (id: number) => string;
  optimizacionCuota: string;
  rendimientoComputable: (amount: string) => string;
  estasEnTramo: (id: number, min: string, max: string) => string;
  bajarDeTramo: string;
  justificaExtra: (amount: string) => string;
  margenGanancia: string;
  puedesGanarExtra: (amount: string) => string;
  ilimitado: string;
  maxInfinito: string;

  breakdownTitle: string;
  introduceIngresos: string;
  gastosActividad: string;
  seguridadSocialLabel: string;
  irpfPct: (pct: string) => string;
  netoLimpio: string;

  infoTecnicaTitle: string;
  infoTecnicaText: string;
  tipoMarginalActual: (pct: string) => string;
  tipoMarginalText: (pct: string) => string;

  footer: string;
}

export const translations: Record<Lang, Translations> = {
  es: {
    appTitle: 'Simulador Fiscal',
    toggleAnual: 'Anual',
    toggleMensual: 'Mensual',
    bruto: 'Bruto',
    neto: 'Neto',
    segSocial: 'Seg. Social',
    irpfMedio: 'IRPF Medio',
    exportar: 'Exportar',
    importar: 'Importar',
    importError: 'Archivo inválido. Debe ser un JSON exportado desde esta app.',

    perfilPersonalTitle: 'Perfil Personal (IRPF)',
    comAutonoma: 'Com. Autónoma',
    estadoCivil: 'Estado Civil',
    estadoCivilOptions: {
      soltero: 'Soltero/a',
      casado_indiv: 'Casado (Indiv)',
      casado_conjunta: 'Casado (Conjunta)',
    },
    hijosACargo: 'Hijos a cargo',
    hijosOptions: { ninguno: 'Ninguno', masDe4: '4 o más' },
    minimoPersonalExento: (amount) => `Mínimo Personal exento aplicado: ${amount}`,

    ingresosTitle: 'Ingresos',
    anadir: 'Añadir',
    nombrePlaceholder: 'Nombre',
    cuentaAjena: 'Cuenta Ajena',
    freelance: 'Freelance',
    periodMensual: 'Mensual',
    periodAnual: 'Anual',
    ingresoLabel: 'Ingreso',
    gastosDeduciblesLabel: 'Gastos Deducibles',
    defaultIncomeName: 'Trabajo Principal',
    nuevoIngreso: 'Nuevo Ingreso',

    cuotaAutonomoTitle: 'Cuota Autónomo',
    eurMesSegSocial: '€/mes a Seg. Social',
    calculadoSegunTramo: (id) => `Calculado según Tramo ${id}`,
    optimizacionCuota: 'Optimización de cuota',
    rendimientoComputable: (amount) => `Rendimiento computable: ${amount}/mes.`,
    estasEnTramo: (id, min, max) => `Estás en el Tramo ${id} (${min} - ${max}).`,
    bajarDeTramo: 'Bajar de tramo',
    justificaExtra: (amount) => `Justifica ${amount}/mes extra en gastos.`,
    margenGanancia: 'Margen ganancia',
    puedesGanarExtra: (amount) => `Puedes ganar ${amount}/mes extra sin subir cuota.`,
    ilimitado: 'Ilimitado',
    maxInfinito: '+ Infinito',

    breakdownTitle: 'A dónde va cada Euro de tu Bruto Total',
    introduceIngresos: 'Introduce ingresos para ver el desglose',
    gastosActividad: 'Gastos Actividad',
    seguridadSocialLabel: 'Seguridad Social',
    irpfPct: (pct) => `IRPF (${pct}%)`,
    netoLimpio: 'Neto Limpio',

    infoTecnicaTitle: 'Información Técnica',
    infoTecnicaText:
      'Calculado restando automáticamente el 5% de gastos de difícil justificación sobre rendimientos de IRPF (tope 2.000€) y el 7% para el cómputo del tramo de la Seguridad Social.',
    tipoMarginalActual: (pct) => `Tipo Marginal Actual: ${pct}%`,
    tipoMarginalText: (pct) =>
      `De cada 100€ extras que ganes ahora, Hacienda retendrá ${pct}€. Y por cada 100€ que logres deducir, te ahorrarás esa misma cantidad en tu Declaración.`,

    footer: 'developed by anderwien',
  },
  en: {
    appTitle: 'Tax Simulator',
    toggleAnual: 'Annual',
    toggleMensual: 'Monthly',
    bruto: 'Gross',
    neto: 'Net',
    segSocial: 'Social Sec.',
    irpfMedio: 'Avg. Income Tax',
    exportar: 'Export',
    importar: 'Import',
    importError: 'Invalid file. Must be a JSON file exported from this app.',

    perfilPersonalTitle: 'Personal Profile (Income Tax)',
    comAutonoma: 'Region (CCAA)',
    estadoCivil: 'Marital Status',
    estadoCivilOptions: {
      soltero: 'Single',
      casado_indiv: 'Married (Individual)',
      casado_conjunta: 'Married (Joint)',
    },
    hijosACargo: 'Dependent children',
    hijosOptions: { ninguno: 'None', masDe4: '4 or more' },
    minimoPersonalExento: (amount) => `Personal tax-free minimum applied: ${amount}`,

    ingresosTitle: 'Income',
    anadir: 'Add',
    nombrePlaceholder: 'Name',
    cuentaAjena: 'Employee',
    freelance: 'Freelance',
    periodMensual: 'Monthly',
    periodAnual: 'Annual',
    ingresoLabel: 'Income',
    gastosDeduciblesLabel: 'Deductible Expenses',
    defaultIncomeName: 'Main Job',
    nuevoIngreso: 'New Income',

    cuotaAutonomoTitle: 'Self-Employed Contribution',
    eurMesSegSocial: '€/month to Social Security',
    calculadoSegunTramo: (id) => `Calculated per Bracket ${id}`,
    optimizacionCuota: 'Contribution optimization',
    rendimientoComputable: (amount) => `Computable income: ${amount}/month.`,
    estasEnTramo: (id, min, max) => `You're in Bracket ${id} (${min} - ${max}).`,
    bajarDeTramo: 'Drop a bracket',
    justificaExtra: (amount) => `Justify ${amount}/month extra in expenses.`,
    margenGanancia: 'Room to grow',
    puedesGanarExtra: (amount) => `You can earn ${amount}/month extra without a higher contribution.`,
    ilimitado: 'Unlimited',
    maxInfinito: '+ Unlimited',

    breakdownTitle: 'Where Every Euro of Your Gross Income Goes',
    introduceIngresos: 'Add income to see the breakdown',
    gastosActividad: 'Business Expenses',
    seguridadSocialLabel: 'Social Security',
    irpfPct: (pct) => `Income Tax (${pct}%)`,
    netoLimpio: 'Net Income',

    infoTecnicaTitle: 'Technical Details',
    infoTecnicaText:
      'Calculated by automatically deducting the 5% hard-to-justify expense allowance from income-tax earnings (capped at €2,000) and 7% for the Social Security bracket calculation.',
    tipoMarginalActual: (pct) => `Current Marginal Rate: ${pct}%`,
    tipoMarginalText: (pct) =>
      `For every extra €100 you earn now, the tax office withholds €${pct}. And for every €100 you manage to deduct, you save that same amount on your tax return.`,

    footer: 'developed by anderwien',
  },
};
