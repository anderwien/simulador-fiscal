import { useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { PlusCircle, Trash2, Info, TrendingUp, AlertCircle, ChevronDown, ChevronUp, DollarSign, PieChart, Target, Calculator, BarChart, Users, MapPin, Download, Upload, Building2, Receipt } from 'lucide-react';
import { translations, type Lang } from './i18n';
import BreakdownTreemap from './components/BreakdownTreemap';

// --- CONSTANTES FISCALES ---
// Escala Estatal + Autonómica Promedio
const CCAA_RATES = {
  'Madrid': [ { max: 12450, rate: 0.185 }, { max: 20200, rate: 0.232 }, { max: 35200, rate: 0.283 }, { max: 60000, rate: 0.359 }, { max: 300000, rate: 0.435 }, { max: Infinity, rate: 0.45 } ],
  'Cataluña': [ { max: 12450, rate: 0.20 }, { max: 20200, rate: 0.24 }, { max: 35200, rate: 0.30 }, { max: 60000, rate: 0.40 }, { max: 300000, rate: 0.46 }, { max: Infinity, rate: 0.48 } ],
  'Comunidad Valenciana': [ { max: 12450, rate: 0.19 }, { max: 20200, rate: 0.24 }, { max: 35200, rate: 0.30 }, { max: 60000, rate: 0.37 }, { max: 300000, rate: 0.45 }, { max: Infinity, rate: 0.47 } ],
  'Andalucía': [ { max: 12450, rate: 0.19 }, { max: 20200, rate: 0.24 }, { max: 35200, rate: 0.30 }, { max: 60000, rate: 0.37 }, { max: 300000, rate: 0.45 }, { max: Infinity, rate: 0.47 } ],
  'General/Resto': [ { max: 12450, rate: 0.19 }, { max: 20200, rate: 0.24 }, { max: 35200, rate: 0.30 }, { max: 60000, rate: 0.37 }, { max: 300000, rate: 0.45 }, { max: Infinity, rate: 0.47 } ]
};

const IRPF_COLORS = ['bg-emerald-400', 'bg-teal-500', 'bg-cyan-600', 'bg-blue-600', 'bg-indigo-700', 'bg-violet-900'];

const DEDUCCION_SS_EMPLEADO = 0.0647; // ~6.47% cuota obrera

// Cuotas oficiales con MEI (0,9%) integrado
const TRAMOS_AUTONOMO = [
  { id: 1, min: 0, max: 670, cuota: 206.62 },
  { id: 2, min: 670.01, max: 900, cuota: 227.35 },
  { id: 3, min: 900.01, max: 1166.70, cuota: 268.85 },
  { id: 4, min: 1166.71, max: 1300, cuota: 283.56 },
  { id: 5, min: 1300.01, max: 1500, cuota: 300.24 },
  { id: 6, min: 1500.01, max: 1700, cuota: 303.24 },
  { id: 7, min: 1700.01, max: 1850, cuota: 360.29 },
  { id: 8, min: 1850.01, max: 2030, cuota: 380.88 },
  { id: 9, min: 2030.01, max: 2330, cuota: 401.47 },
  { id: 10, min: 2330.01, max: 2760, cuota: 427.56 },
  { id: 11, min: 2760.01, max: 3190, cuota: 453.07 },
  { id: 12, min: 3190.01, max: 3620, cuota: 478.79 },
  { id: 13, min: 3620.01, max: 4050, cuota: 504.71 },
  { id: 14, min: 4050.01, max: 6000, cuota: 544.71 },
  { id: 15, min: 6000.01, max: Infinity, cuota: 605.71 }
];

/**
 * amount/expenses siempre se almacenan en anual (el valor canónico), independientemente
 * de si la vista actual es Mensual o Anual. Así, alternar entre vistas o entre pagas nunca
 * reescribe el dato original del usuario con una versión redondeada — solo cambia cómo
 * se muestra (ver getDisplayValue). Esto evita el drift de redondeo en los toggles.
 */
interface Income {
  id: number;
  name: string;
  type: string;
  amount: number;
  expenses: number;
  pagas: number;
}

interface ImportedIncome {
  id?: number;
  name?: string;
  type?: string;
  amount?: number;
  expenses?: number;
  pagas?: number;
}

/** Multiplicador anual<->mensual: pagas extra solo aplican a rentas de trabajo por cuenta ajena. */
function getIncomeFactor(inc: { type: string; pagas: number }): number {
  return inc.type === 'empleado' && inc.pagas === 14 ? 14 : 12;
}

/** Convierte un valor anual canónico a lo que debe mostrarse según la vista actual (solo para mostrar, nunca se guarda). */
function getDisplayValue(annualValue: number, period: 'anual' | 'mensual', factor: number): number {
  const raw = period === 'anual' ? annualValue : annualValue / factor;
  return Math.round(raw * 100) / 100;
}

interface ImportedData {
  incomes?: ImportedIncome[];
  incomePeriod?: string;
  employerSSRate?: number;
  autonomoQuota?: number;
  autoCalculateQuota?: boolean;
  ccaa?: string;
  estadoCivil?: string;
  hijos?: number;
}

interface IrpfTramo {
  max: number;
  rate: number;
}

/** Progressive IRPF calculation over a base, reused for the full declaration and for the employer-retention-only estimate. */
function computeIrpfProgressive(base: number, minimoPersonal: number, tramos: IrpfTramo[]) {
  let baseRestante = base;
  let minimoRestante = minimoPersonal;
  let limiteAnterior = 0;
  let cuotaTotal = 0;
  let marginalRate = 0;
  const breakdown: { rate: number; amount: number; tramoIndex: number }[] = [];

  tramos.forEach((tramo, index) => {
    const anchoTramo = tramo.max - limiteAnterior;
    const amountBaseInTramo = Math.max(0, Math.min(baseRestante, anchoTramo));
    const amountMinimoInTramo = Math.max(0, Math.min(minimoRestante, anchoTramo));
    const taxInTramo = (amountBaseInTramo * tramo.rate) - (amountMinimoInTramo * tramo.rate);

    if (amountBaseInTramo > 0) {
      cuotaTotal += taxInTramo;
      marginalRate = tramo.rate;
      breakdown.push({ rate: tramo.rate * 100, amount: taxInTramo, tramoIndex: index });
    }

    baseRestante -= amountBaseInTramo;
    minimoRestante -= amountMinimoInTramo;
    limiteAnterior = tramo.max;
  });

  return { cuota: Math.max(0, cuotaTotal), marginalRate, breakdown };
}

export default function App() {
  const [lang, setLang] = useState<Lang>('es');
  const t = translations[lang];

  // Estado Incomes y Cuota
  const [incomes, setIncomes] = useState<Income[]>([
    { id: 1, name: 'Trabajo Principal', type: 'empleado', amount: 30000, expenses: 0, pagas: 12 }
  ]);
  const [incomePeriod, setIncomePeriod] = useState<'mensual' | 'anual'>('anual');
  const [autonomoQuota, setAutonomoQuota] = useState(478.79);
  const [autoCalculateQuota, setAutoCalculateQuota] = useState(true);
  const [showOptimization, setShowOptimization] = useState(false);
  const [nominaDetalleIds, setNominaDetalleIds] = useState<Set<number>>(new Set());
  const [showInfoGastos, setShowInfoGastos] = useState(false);
  const [showInfoPagas14, setShowInfoPagas14] = useState(false);
  const [showInfoMarginal, setShowInfoMarginal] = useState(false);
  const [isMonthlyView, setIsMonthlyView] = useState(false); // Toggle Anual/Mensual
  const [employerSSRate, setEmployerSSRate] = useState(31);
  const [includeEmployerCost, setIncludeEmployerCost] = useState(false);

  // Estados Personales IRPF
  const [ccaa, setCcaa] = useState('Comunidad Valenciana');
  const [estadoCivil, setEstadoCivil] = useState('soltero');
  const [hijos, setHijos] = useState(0);

  // Import/Export
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // --- LÓGICA DE CÁLCULO ---
  const calculations = useMemo(() => {
    let grossAnualTotal = 0;
    let ssEmpleadoAnual = 0;
    let autonomoGrossAnual = 0;
    let autonomoExpensesAnual = 0;

    // Sumar ingresos (amount/expenses ya están siempre en anual, ver comentario en la interfaz Income)
    incomes.forEach(inc => {
      const anualAmount = Number(inc.amount) || 0;
      const anualExpenses = Number(inc.expenses) || 0;

      grossAnualTotal += anualAmount;

      if (inc.type === 'empleado') {
        ssEmpleadoAnual += anualAmount * DEDUCCION_SS_EMPLEADO;
      } else {
        autonomoGrossAnual += anualAmount;
        autonomoExpensesAnual += anualExpenses;
      }
    });

    // 1. Autónomo: Calcular Rendimiento para Tramos SS (-7% ded. difícil justificación)
    const rendimientoNetoSSMensual = autonomoGrossAnual > 0
      ? ((autonomoGrossAnual - autonomoExpensesAnual) / 12) * 0.93
      : 0;

    const currentTramo = TRAMOS_AUTONOMO.find(tr => rendimientoNetoSSMensual >= tr.min && rendimientoNetoSSMensual <= tr.max) || TRAMOS_AUTONOMO[0];
    const safeAutonomoQuota = Number(autonomoQuota) || 0;
    const cuotaFinal = autoCalculateQuota ? currentTramo.cuota : safeAutonomoQuota;
    const ssAutonomoAnual = autonomoGrossAnual > 0 ? cuotaFinal * 12 : 0;

    // 2. Autónomo: Calcular Rendimiento para IRPF (-5% ded. difícil justificación)
    let rendimientoNetoIRPF = autonomoGrossAnual - autonomoExpensesAnual - ssAutonomoAnual;
    if (rendimientoNetoIRPF > 0) {
      const deduccionAplicadaIRPF = Math.min(rendimientoNetoIRPF * 0.05, 2000);
      rendimientoNetoIRPF -= deduccionAplicadaIRPF;
    } else {
      rendimientoNetoIRPF = 0;
    }

    // 3. Mínimo Personal y Familiar
    let minimoPersonal = 5550;
    if (hijos >= 1) minimoPersonal += 2400;
    if (hijos >= 2) minimoPersonal += 2700;
    if (hijos >= 3) minimoPersonal += 4000;
    if (hijos >= 4) minimoPersonal += 4500;
    if (estadoCivil === 'casado_conjunta') minimoPersonal += 3400;

    // 4. Base Imponible
    const rendimientosTrabajo = (grossAnualTotal - autonomoGrossAnual) - ssEmpleadoAnual;
    const baseImponible = rendimientosTrabajo + rendimientoNetoIRPF;

    // 5. Cálculo IRPF progresivo (declaración completa: trabajo + autónomo)
    const tramosAplicables = CCAA_RATES[ccaa as keyof typeof CCAA_RATES];
    const { cuota: cuotaIRPF_Total, marginalRate, breakdown: irpfBreakdownRaw } = computeIrpfProgressive(baseImponible, minimoPersonal, tramosAplicables);
    const irpfBreakdown = irpfBreakdownRaw.map(b => ({
      rate: b.rate,
      amount: b.amount,
      color: IRPF_COLORS[b.tramoIndex],
      porcentajeDelBruto: grossAnualTotal > 0 ? (b.amount / grossAnualTotal) * 100 : 0
    }));

    // 5b. Retención IRPF estimada que debería aplicar el empleador (solo rendimientos del trabajo)
    const { cuota: retencionIRPFAnual } = computeIrpfProgressive(Math.max(0, rendimientosTrabajo), minimoPersonal, tramosAplicables);
    const tipoRetencionEstimado = rendimientosTrabajo > 0 ? (retencionIRPFAnual / rendimientosTrabajo) * 100 : 0;

    const ssTotalAnual = ssEmpleadoAnual + ssAutonomoAnual;
    const netAnual = grossAnualTotal - ssTotalAnual - cuotaIRPF_Total - autonomoExpensesAnual;

    // 6. Coste para la empresa (Seguridad Social a cargo del empleador)
    const empleadoGrossAnual = grossAnualTotal - autonomoGrossAnual;
    const costeEmpresaAnual = empleadoGrossAnual * (employerSSRate / 100);
    const costeEmpresaTotalAnual = empleadoGrossAnual + costeEmpresaAnual;

    // Datos Gráfico Macro
    const chartSegments = [
      { id: 'gastos', label: t.gastosActividad, amount: autonomoExpensesAnual, color: 'bg-slate-500', porc: (autonomoExpensesAnual / grossAnualTotal) * 100 },
      { id: 'ss', label: t.seguridadSocialLabel, amount: ssTotalAnual, color: 'bg-amber-500', porc: (ssTotalAnual / grossAnualTotal) * 100 },
      ...irpfBreakdown.map((tr, i) => ({ id: `irpf_${i}`, label: t.irpfPct(tr.rate.toFixed(0)), amount: tr.amount, color: tr.color, porc: tr.porcentajeDelBruto })),
      { id: 'neto', label: t.netoLimpio, amount: netAnual, color: 'bg-indigo-500', porc: (netAnual / grossAnualTotal) * 100 }
    ];

    return {
      grossAnualTotal,
      ssTotalAnual,
      autonomoExpensesAnual,
      cuotaIRPF: cuotaIRPF_Total,
      netAnual,
      netMensual: netAnual / 12,
      rendimientoNetoSSMensual,
      currentTramo,
      cuotaFinalMensual: cuotaFinal,
      marginalRate,
      irpfBreakdown,
      baseImponible,
      minimoPersonal,
      chartSegments,
      hasAutonomo: autonomoGrossAnual > 0,
      hasEmpleado: empleadoGrossAnual > 0,
      empleadoGrossAnual,
      costeEmpresaAnual,
      costeEmpresaTotalAnual,
      retencionIRPFAnual,
      retencionIRPFMensual: retencionIRPFAnual / 12,
      tipoRetencionEstimado,
      porcNeto: grossAnualTotal > 0 ? (netAnual / grossAnualTotal) * 100 : 0,
      porcSS: grossAnualTotal > 0 ? (ssTotalAnual / grossAnualTotal) * 100 : 0,
      porcIRPF: grossAnualTotal > 0 ? (cuotaIRPF_Total / grossAnualTotal) * 100 : 0
    };
  }, [incomes, autonomoQuota, autoCalculateQuota, ccaa, estadoCivil, hijos, employerSSRate, lang, t]);

  // Segmentos del treemap, con el coste de empresa opcionalmente incluido en el total mostrado
  const treemapSegments = useMemo(() => {
    const base = calculations.chartSegments;
    if (!includeEmployerCost || !calculations.hasEmpleado || calculations.costeEmpresaAnual <= 0) {
      return base;
    }
    const total = calculations.grossAnualTotal + calculations.costeEmpresaAnual;
    const withEmployerCost = [
      ...base,
      { id: 'costeEmpresa', label: t.costeEmpresaSegmentLabel, amount: calculations.costeEmpresaAnual, color: 'bg-fuchsia-600', porc: 0 }
    ];
    return withEmployerCost.map(seg => ({ ...seg, porc: total > 0 ? (seg.amount / total) * 100 : 0 }));
  }, [calculations, includeEmployerCost, t]);

  const addIncome = () => {
    setIncomes([...incomes, { id: Date.now(), name: t.nuevoIngreso, type: 'empleado', amount: 12000, expenses: 0, pagas: 12 }]);
  };

  /**
   * amount/expenses son siempre el valor anual canónico. Si el campo editado es uno de esos dos,
   * el número tecleado está en la unidad que se está mostrando (Anual o Mensual), así que se
   * convierte a anual antes de guardar — nunca se guarda el valor ya redondeado de otra vista.
   */
  const updateIncome = (id: number, field: string, value: string) => {
    setIncomes(incomes.map(inc => {
      if (inc.id !== id) return inc;
      if (field === 'name' || field === 'type') return { ...inc, [field]: value };

      const raw = Number(value);
      const safeRaw = Number.isNaN(raw) ? 0 : raw;

      if (field === 'amount' || field === 'expenses') {
        const factor = getIncomeFactor(inc);
        const annualValue = incomePeriod === 'anual' ? safeRaw : safeRaw * factor;
        return { ...inc, [field]: annualValue };
      }

      return { ...inc, [field]: safeRaw };
    }));
  };

  // El dato guardado (amount) es siempre anual, así que cambiar de pagas no necesita recalcular nada.
  const updateIncomePagas = (id: number, newPagas: 12 | 14) => {
    setIncomes(prev => prev.map(inc => (inc.id === id ? { ...inc, pagas: newPagas } : inc)));
  };

  // El dato guardado es siempre anual, así que cambiar de vista tampoco necesita recalcular nada.
  const changeIncomePeriod = (newPeriod: 'mensual' | 'anual') => {
    setIncomePeriod(newPeriod);
  };

  const removeIncome = (id: number) => setIncomes(incomes.filter(inc => inc.id !== id));

  const toggleNominaDetalle = (id: number) => {
    setNominaDetalleIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const formatCurrency = (num: number) => new Intl.NumberFormat(lang === 'es' ? 'es-ES' : 'en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(num);

  const handleExport = () => {
    const payload = { incomes, incomePeriod, employerSSRate, autonomoQuota, autoCalculateQuota, ccaa, estadoCivil, hijos };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const today = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `simulador-fiscal-${today}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    setImportError(null);
    fileInputRef.current?.click();
  };

  const handleImportFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result)) as ImportedData;
        if (!Array.isArray(data.incomes)) throw new Error('invalid incomes');

        const parsedIncomes: Income[] = data.incomes.map((inc, i) => ({
          id: Number(inc.id) || Date.now() + i,
          name: String(inc.name ?? ''),
          type: inc.type === 'autonomo' ? 'autonomo' : 'empleado',
          amount: Number(inc.amount) || 0,
          expenses: Number(inc.expenses) || 0,
          pagas: inc.pagas === 14 ? 14 : 12,
        }));

        setIncomes(parsedIncomes);
        setIncomePeriod(data.incomePeriod === 'mensual' ? 'mensual' : 'anual');
        if (typeof data.employerSSRate === 'number') setEmployerSSRate(data.employerSSRate);
        if (typeof data.autonomoQuota === 'number') setAutonomoQuota(data.autonomoQuota);
        if (typeof data.autoCalculateQuota === 'boolean') setAutoCalculateQuota(data.autoCalculateQuota);
        if (typeof data.ccaa === 'string' && data.ccaa in CCAA_RATES) setCcaa(data.ccaa);
        if (typeof data.estadoCivil === 'string') setEstadoCivil(data.estadoCivil);
        if (typeof data.hijos === 'number') setHijos(data.hijos);
        setImportError(null);
      } catch {
        setImportError(t.importError);
      }
    };
    reader.readAsText(file);
  };

  const distanceToNextTramo = calculations.currentTramo.max - calculations.rendimientoNetoSSMensual;
  const distanceToPrevTramo = calculations.rendimientoNetoSSMensual - calculations.currentTramo.min;

  // Variables calculadas según el modo (Anual o Mensual) de la barra Sticky
  const displayGross = isMonthlyView ? calculations.grossAnualTotal / 12 : calculations.grossAnualTotal;
  const displayNet = isMonthlyView ? calculations.netAnual / 12 : calculations.netAnual;
  const displaySS = isMonthlyView ? calculations.ssTotalAnual / 12 : calculations.ssTotalAnual;
  const displayIRPF = isMonthlyView ? calculations.cuotaIRPF / 12 : calculations.cuotaIRPF;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col relative">

      {/* STICKY HEADER SUMMARY */}
      <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-200 py-3 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header Superior: Titulillo y Controles */}
          <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
             <div className="flex items-center gap-1.5 text-indigo-600">
               <Target size={16} />
               <div className="leading-tight">
                 <span className="text-xs font-bold uppercase tracking-widest block">{t.appTitle}</span>
                 <span className="text-[10px] text-slate-400 font-medium block normal-case tracking-normal">{t.appSubtitle}</span>
               </div>
             </div>

             <div className="flex items-center gap-2 flex-wrap">
                {/* Toggle Idioma */}
                <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
                  <button
                    onClick={() => setLang('es')}
                    className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-colors ${lang === 'es' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    ES
                  </button>
                  <button
                    onClick={() => setLang('en')}
                    className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-colors ${lang === 'en' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    EN
                  </button>
                </div>

                {/* Import / Export */}
                <button onClick={handleExport} title={t.exportar} className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors">
                  <Download size={14} /> {t.exportar}
                </button>
                <button onClick={handleImportClick} title={t.importar} className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors">
                  <Upload size={14} /> {t.importar}
                </button>
                <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleImportFile} />

                {/* Toggle Anual/Mensual */}
                <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
                   <button
                     onClick={() => setIsMonthlyView(false)}
                     className={`text-xs font-semibold px-3 py-1 rounded-md transition-colors ${!isMonthlyView ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                   >
                     {t.toggleAnual}
                   </button>
                   <button
                     onClick={() => setIsMonthlyView(true)}
                     className={`text-xs font-semibold px-3 py-1 rounded-md transition-colors ${isMonthlyView ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                   >
                     {t.toggleMensual}
                   </button>
                </div>
             </div>
          </div>

          {importError && (
            <div className="mb-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-1.5">
              {importError}
            </div>
          )}

          {/* Fila de Métricas */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">

            {/* Izquierda: Bruto y Neto */}
            <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto justify-between md:justify-start">
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-0.5">{t.bruto}</p>
                <p className="text-2xl md:text-3xl font-black text-slate-800 leading-none">{formatCurrency(displayGross)}</p>
              </div>
              <div className="h-10 w-px bg-slate-200 hidden md:block"></div>
              <div className="text-right md:text-left">
                <p className="text-xs text-indigo-600 font-bold uppercase tracking-wider mb-0.5 flex items-center justify-end md:justify-start gap-2">
                  {t.neto}
                  {calculations.grossAnualTotal > 0 && <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-[10px]">{calculations.porcNeto.toFixed(1)}%</span>}
                </p>
                <p className="text-3xl md:text-4xl font-black text-indigo-600 leading-none">{formatCurrency(displayNet)}</p>
              </div>
            </div>

            {/* Derecha: SS e IRPF */}
            <div className="flex gap-6 w-full md:w-auto justify-between md:justify-end border-t border-slate-100 md:border-0 pt-3 md:pt-0">
              <div>
                <span className="text-slate-500 flex items-center gap-1 text-xs font-semibold uppercase">
                  {t.segSocial}
                  {calculations.grossAnualTotal > 0 && <span className="text-amber-500">({calculations.porcSS.toFixed(1)}%)</span>}
                </span>
                <span className="font-bold text-amber-600 text-lg leading-none">-{formatCurrency(displaySS)}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-500 flex items-center justify-end gap-1 text-xs font-semibold uppercase">
                  {t.irpfMedio}
                  {calculations.grossAnualTotal > 0 && <span className="text-rose-500">({calculations.porcIRPF.toFixed(1)}%)</span>}
                </span>
                <span className="font-bold text-rose-500 text-lg leading-none">-{formatCurrency(displayIRPF)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-8 flex-grow w-full">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* COLUMNA IZQUIERDA: INPUTS */}
            <div className="lg:col-span-1 space-y-4">

              {/* Panel Perfil Personal */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <h2 className="text-lg font-semibold flex items-center gap-2 mb-4 text-slate-800">
                  <Users size={20} className="text-indigo-500"/> {t.perfilPersonalTitle}
                </h2>
                <div className="space-y-3 text-sm">
                  <div>
                    <label className="font-medium text-slate-500 mb-1 flex items-center gap-1"><MapPin size={14}/> {t.comAutonoma}</label>
                    <select value={ccaa} onChange={(e) => setCcaa(e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500">
                      {Object.keys(CCAA_RATES).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-medium text-slate-500 mb-1 block">{t.estadoCivil}</label>
                      <select value={estadoCivil} onChange={(e) => setEstadoCivil(e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="soltero">{t.estadoCivilOptions.soltero}</option>
                        <option value="casado_indiv">{t.estadoCivilOptions.casado_indiv}</option>
                        <option value="casado_conjunta">{t.estadoCivilOptions.casado_conjunta}</option>
                      </select>
                    </div>
                    <div>
                      <label className="font-medium text-slate-500 mb-1 block">{t.hijosACargo}</label>
                      <select value={hijos} onChange={(e) => setHijos(Number(e.target.value))} className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="0">{t.hijosOptions.ninguno}</option>
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="4">{t.hijosOptions.masDe4}</option>
                      </select>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-indigo-600 font-medium p-2 bg-indigo-50 rounded-lg border border-indigo-100">
                    {t.minimoPersonalExento(formatCurrency(calculations.minimoPersonal))}
                  </div>
                </div>
              </div>

              {/* Panel Ingresos */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <DollarSign size={20} className="text-emerald-500"/> {t.ingresosTitle}
                  </h2>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
                      <button
                        onClick={() => changeIncomePeriod('mensual')}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-colors ${incomePeriod === 'mensual' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        {t.periodMensual}
                      </button>
                      <button
                        onClick={() => changeIncomePeriod('anual')}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-colors ${incomePeriod === 'anual' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        {t.periodAnual}
                      </button>
                    </div>
                    <button onClick={addIncome} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1.5 font-medium rounded-md flex items-center gap-1 hover:bg-indigo-100 transition-colors">
                      <PlusCircle size={14} /> {t.anadir}
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {incomes.map((inc) => {
                    const sliderMax = incomePeriod === 'anual' ? 150000 : 12000;
                    const sliderStep = incomePeriod === 'anual' ? 500 : 50;
                    const incomeFactor = getIncomeFactor(inc);
                    const displayAmount = getDisplayValue(Number(inc.amount) || 0, incomePeriod, incomeFactor);
                    const displayExpenses = getDisplayValue(Number(inc.expenses) || 0, incomePeriod, incomeFactor);
                    return (
                    <div key={inc.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <input type="text" value={inc.name} onChange={(e) => updateIncome(inc.id, 'name', e.target.value)} className="flex-1 min-w-0 p-1.5 border border-slate-200 rounded bg-white" placeholder={t.nombrePlaceholder}/>
                        <select value={inc.type} onChange={(e) => updateIncome(inc.id, 'type', e.target.value)} className="w-32 shrink-0 p-1.5 border border-slate-200 rounded bg-white">
                          <option value="empleado">{t.cuentaAjena}</option>
                          <option value="autonomo">{t.freelance}</option>
                        </select>
                        <button onClick={() => removeIncome(inc.id)} className="shrink-0 p-1 text-slate-400 hover:text-red-500">
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {inc.type === 'empleado' && incomePeriod === 'mensual' && (
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <div className="flex items-center bg-white p-0.5 rounded-md border border-slate-200">
                            <button type="button" onClick={() => updateIncomePagas(inc.id, 12)} className={`text-[10px] font-semibold px-2 py-0.5 rounded transition-colors ${inc.pagas === 12 ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400 hover:text-slate-600'}`}>
                              {t.pagas12}
                            </button>
                            <button type="button" onClick={() => updateIncomePagas(inc.id, 14)} className={`text-[10px] font-semibold px-2 py-0.5 rounded transition-colors ${inc.pagas === 14 ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400 hover:text-slate-600'}`}>
                              {t.pagas14}
                            </button>
                          </div>
                          <label className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500 cursor-pointer select-none">
                            <input type="checkbox" checked={nominaDetalleIds.has(inc.id)} onChange={() => toggleNominaDetalle(inc.id)} className="rounded accent-indigo-600"/>
                            {t.detallesNominaLabel}
                          </label>
                        </div>
                      )}

                      <div className="mb-2">
                        <label className="text-xs font-medium text-slate-500">
                          {t.ingresoLabel} ({incomePeriod === 'anual' ? t.periodAnual : t.periodMensual}{inc.type === 'empleado' && inc.pagas === 14 && incomePeriod === 'mensual' ? ` · ${t.porPagaLabel}` : ''})
                        </label>
                        <div className="flex items-center gap-2 mt-1">
                          <input type="range" min="0" max={sliderMax} step={sliderStep} value={displayAmount} onChange={(e) => updateIncome(inc.id, 'amount', e.target.value)} className="flex-1 accent-indigo-600"/>
                          <input type="number" value={displayAmount} onChange={(e) => updateIncome(inc.id, 'amount', e.target.value)} className="w-24 p-1 border border-slate-300 rounded font-medium text-slate-700"/>
                        </div>
                      </div>

                      {inc.type === 'autonomo' && (
                        <div className="pt-2 border-t border-slate-200">
                          <label className="text-xs font-medium text-orange-600">{t.gastosDeduciblesLabel}</label>
                          <div className="flex items-center gap-2 mt-1">
                            <input type="range" min="0" max={displayAmount || 1000} step="10" value={displayExpenses} onChange={(e) => updateIncome(inc.id, 'expenses', e.target.value)} className="flex-1 accent-orange-500"/>
                            <input type="number" value={displayExpenses} onChange={(e) => updateIncome(inc.id, 'expenses', e.target.value)} className="w-24 p-1 border border-slate-300 rounded font-medium text-slate-700"/>
                          </div>
                        </div>
                      )}

                      {inc.type === 'empleado' && incomePeriod === 'mensual' && nominaDetalleIds.has(inc.id) && (() => {
                        const perPaymentBruto = (Number(inc.amount) || 0) / inc.pagas;
                        const ssAnualEstaFuente = perPaymentBruto * inc.pagas * DEDUCCION_SS_EMPLEADO;
                        const ssPerOrdinaria = ssAnualEstaFuente / 12;
                        // El IRPF se retiene sobre el bruto ya neto de SS de esa nómina; la extra no tiene SS que restar.
                        const baseOrdinaria = perPaymentBruto - ssPerOrdinaria;
                        const irpfOrdinaria = (calculations.tipoRetencionEstimado / 100) * baseOrdinaria;
                        const irpfExtra = (calculations.tipoRetencionEstimado / 100) * perPaymentBruto;
                        const netoOrdinaria = baseOrdinaria - irpfOrdinaria;
                        const netoExtra = perPaymentBruto - irpfExtra;
                        return (
                          <div className={`pt-2 border-t border-slate-200 grid gap-3 text-xs ${inc.pagas === 14 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                            <div>
                              <p className="font-semibold text-slate-600 mb-1">{t.nominaOrdinariaLabel}</p>
                              <p className="text-slate-500">{t.ingresoLabel}: {formatCurrency(perPaymentBruto)}</p>
                              <p className="text-amber-600">−SS: {formatCurrency(ssPerOrdinaria)}</p>
                              <p className="text-rose-500">−IRPF: {formatCurrency(irpfOrdinaria)}</p>
                              <p className="font-bold text-slate-800">{t.netoAbrevLabel}: {formatCurrency(netoOrdinaria)}</p>
                            </div>
                            {inc.pagas === 14 && (
                              <div>
                                <p className="font-semibold text-slate-600 mb-1">{t.pagaExtraLabel}</p>
                                <p className="text-slate-500">{t.ingresoLabel}: {formatCurrency(perPaymentBruto)}</p>
                                <p className="text-rose-500">−IRPF: {formatCurrency(irpfExtra)}</p>
                                <p className="font-bold text-slate-800">{t.netoAbrevLabel}: {formatCurrency(netoExtra)}</p>
                                <p className="text-slate-400">({t.sinSSLabel})</p>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                    );
                  })}
                </div>
              </div>

              {/* Información Técnica */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2 mb-4"><Info size={18} className="text-blue-500"/> {t.infoTecnicaTitle}</h2>
                <div className="space-y-2">
                  {calculations.hasAutonomo && (
                    <div className="bg-slate-50 rounded-xl border border-slate-100">
                      <button
                        onClick={() => setShowInfoGastos(!showInfoGastos)}
                        className="w-full flex items-center justify-between gap-2 p-3 text-sm font-semibold text-slate-700"
                      >
                        <span className="flex items-center gap-2"><AlertCircle className="shrink-0 text-slate-400" size={16} /> {t.infoGastosTitle}</span>
                        {showInfoGastos ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                      </button>
                      {showInfoGastos && <p className="px-3 pb-3 text-sm text-slate-600">{t.infoTecnicaText}</p>}
                    </div>
                  )}

                  {incomes.some(inc => inc.type === 'empleado' && inc.pagas === 14) && (
                    <div className="bg-slate-50 rounded-xl border border-slate-100">
                      <button
                        onClick={() => setShowInfoPagas14(!showInfoPagas14)}
                        className="w-full flex items-center justify-between gap-2 p-3 text-sm font-semibold text-slate-700"
                      >
                        <span className="flex items-center gap-2"><AlertCircle className="shrink-0 text-slate-400" size={16} /> {t.infoPagas14Title}</span>
                        {showInfoPagas14 ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                      </button>
                      {showInfoPagas14 && <p className="px-3 pb-3 text-sm text-slate-600">{t.pagas14InfoText}</p>}
                    </div>
                  )}

                  <div className="bg-indigo-50 rounded-xl border border-indigo-100">
                    <button
                      onClick={() => setShowInfoMarginal(!showInfoMarginal)}
                      className="w-full flex items-center justify-between gap-2 p-3 text-sm font-bold text-indigo-700"
                    >
                      <span className="flex items-center gap-2"><Target className="shrink-0 text-indigo-500" size={16} /> {t.infoMarginalTitle}: {(calculations.marginalRate * 100).toFixed(1)}%</span>
                      {showInfoMarginal ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                    </button>
                    {showInfoMarginal && <p className="px-3 pb-3 text-sm text-indigo-600">{t.tipoMarginalText((calculations.marginalRate * 100).toFixed(1))}</p>}
                  </div>
                </div>
              </div>
            </div>

            {/* COLUMNA DERECHA: RESULTADOS */}
            <div className="lg:col-span-2 space-y-6">

              {/* GRÁFICO TOTAL DEL BRUTO */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                 <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <BarChart size={20} className="text-blue-500"/> {t.breakdownTitle}
                </h3>
                {calculations.hasEmpleado && (
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-600 mb-3 cursor-pointer select-none">
                    <input type="checkbox" checked={includeEmployerCost} onChange={() => setIncludeEmployerCost(v => !v)} className="rounded accent-indigo-600"/>
                    {t.incluirCosteEmpresaCheckbox}
                  </label>
                )}
                <BreakdownTreemap segments={treemapSegments} formatCurrency={formatCurrency} emptyMessage={t.introduceIngresos} />
              </div>

              {/* Coste Empresa + Retención IRPF, uno junto al otro */}
              {calculations.hasEmpleado && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Coste para la Empresa */}
                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                    <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2 mb-4"><Building2 size={18} className="text-blue-500"/> {t.costeEmpresaTitle}</h2>
                    <div className="flex items-center gap-2 mb-4">
                      <input
                        type="number"
                        value={employerSSRate}
                        onChange={(e) => setEmployerSSRate(Number(e.target.value) || 0)}
                        className="w-16 p-1.5 border border-slate-200 rounded-md font-bold text-slate-700 text-center outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <span className="text-xs text-slate-500">% {t.tipoSSEmpresaLabel}</span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">{t.salarioBrutoEmpleadoLabel}</span>
                        <span className="font-semibold text-slate-700">{formatCurrency(isMonthlyView ? calculations.empleadoGrossAnual / 12 : calculations.empleadoGrossAnual)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">{t.ssEmpresaLabel}</span>
                        <span className="font-semibold text-amber-600">+{formatCurrency(isMonthlyView ? calculations.costeEmpresaAnual / 12 : calculations.costeEmpresaAnual)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                        <span className="font-bold text-slate-800">{t.costeTotalEmpresaLabel}</span>
                        <span className="font-black text-indigo-600 text-lg">{formatCurrency(isMonthlyView ? calculations.costeEmpresaTotalAnual / 12 : calculations.costeEmpresaTotalAnual)}</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-4">{t.costeEmpresaCaveat}</p>
                  </div>

                  {/* Retención IRPF Estimada */}
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2 mb-4"><Receipt size={26} className="text-blue-500 -m-1"/> {t.retencionTitle}</h2>
                    <div className="mb-3">
                      <p className="text-xs text-slate-500 font-semibold uppercase mb-0.5">{t.tipoRetencionSublabel}</p>
                      <p className="text-4xl font-black text-indigo-600">{t.tipoRetencionLabel(calculations.tipoRetencionEstimado.toFixed(1))}</p>
                    </div>
                    <p className="text-sm text-slate-600 mb-3">{t.retencionMensualLabel}: <span className="font-semibold text-slate-700">{formatCurrency(calculations.retencionIRPFMensual)}</span></p>
                    <p className="text-xs text-slate-400">{t.retencionCaveat}</p>
                  </div>
                </div>
              )}

              {/* Panel Cuota & Optimización */}
              {calculations.hasAutonomo && (
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2"><PieChart size={18} className="text-blue-500"/> {t.cuotaAutonomoTitle}</h2>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <span className={`text-xs font-semibold ${autoCalculateQuota ? 'text-indigo-600' : 'text-slate-400'}`}>
                        {autoCalculateQuota ? t.calculoAutomatico : t.calculoManual}
                      </span>
                      <input type="checkbox" className="sr-only" checked={autoCalculateQuota} onChange={() => setAutoCalculateQuota(!autoCalculateQuota)}/>
                      <div className={`w-8 h-4 rounded-full transition-colors ${autoCalculateQuota ? 'bg-indigo-500' : 'bg-slate-300'} relative`}>
                        <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 left-0.5 transition-transform ${autoCalculateQuota ? 'translate-x-4' : ''}`}></div>
                      </div>
                    </label>
                  </div>
                  <div className="flex items-center gap-3 mb-2">
                    <input type="number" value={autoCalculateQuota ? calculations.cuotaFinalMensual.toFixed(2) : autonomoQuota} onChange={(e) => {
                      const val = e.target.value;
                      const numVal = val === '' ? 0 : Number(val);
                      setAutonomoQuota(Number.isNaN(numVal) ? 0 : numVal);
                    }} disabled={autoCalculateQuota} className={`w-28 p-2 pl-3 border border-slate-200 rounded-md font-bold text-lg outline-none focus:ring-2 focus:ring-indigo-500 ${autoCalculateQuota ? 'bg-slate-50 text-slate-500' : 'bg-white text-slate-800'}`}/>
                    <span className="text-sm text-slate-500">{t.eurMesSegSocial}</span>
                  </div>
                  {autoCalculateQuota && (
                     <p className="text-xs text-indigo-500 font-medium mb-4 flex items-center gap-1">
                       <Calculator size={12} /> {t.calculadoSegunTramo(calculations.currentTramo.id)}
                     </p>
                  )}

                  {/* SECCIÓN DESPLEGABLE DE OPTIMIZACIÓN */}
                  <div className="border-t border-slate-100 pt-3 mt-4">
                    <button
                      onClick={() => setShowOptimization(!showOptimization)}
                      className="w-full flex items-center justify-between text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors"
                    >
                      <span className="flex items-center gap-2"><TrendingUp size={16}/> {t.optimizacionCuota}</span>
                      {showOptimization ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                    </button>

                    {showOptimization && (
                      <div className="mt-4 space-y-4">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                          <p className="text-sm text-slate-600 mb-4">
                            {t.rendimientoComputable(formatCurrency(calculations.rendimientoNetoSSMensual))}{' '}
                            {t.estasEnTramo(calculations.currentTramo.id, formatCurrency(calculations.currentTramo.min), calculations.currentTramo.max === Infinity ? 'Max' : formatCurrency(calculations.currentTramo.max))}
                          </p>

                          <div className="relative h-6 bg-slate-200 rounded-full overflow-hidden mb-2">
                             <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-400 to-indigo-500"
                                  style={{ width: calculations.currentTramo.max !== Infinity ? `${((calculations.rendimientoNetoSSMensual - calculations.currentTramo.min) / (calculations.currentTramo.max - calculations.currentTramo.min)) * 100}%` : '50%' }}
                             />
                          </div>

                          <div className="flex justify-between text-xs text-slate-400 font-bold">
                            <span>{formatCurrency(calculations.currentTramo.min)}</span>
                            <span>{calculations.currentTramo.max === Infinity ? t.maxInfinito : formatCurrency(calculations.currentTramo.max)}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                            <p className="text-xs text-emerald-600 font-bold mb-1 flex items-center gap-1"><ChevronDown size={14}/> {t.bajarDeTramo}</p>
                            <p className="text-xs text-slate-600 leading-tight">{t.justificaExtra(formatCurrency(distanceToPrevTramo))}</p>
                          </div>
                          <div className="bg-amber-50 p-3 rounded-xl border border-amber-100">
                            <p className="text-xs text-amber-600 font-bold mb-1 flex items-center gap-1"><ChevronUp size={14}/> {t.margenGanancia}</p>
                            <p className="text-xs text-slate-600 leading-tight">{calculations.currentTramo.max === Infinity ? t.ilimitado : t.puedesGanarExtra(formatCurrency(distanceToNextTramo))}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* FOOTER */}
          <footer className="mt-8 text-center text-xs font-medium text-slate-400 py-6 border-t border-slate-200">
            {t.footer}
          </footer>

        </div>
      </div>
    </div>
  );
}
