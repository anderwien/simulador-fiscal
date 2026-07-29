import { useState, useMemo } from 'react';
import { PlusCircle, Trash2, Info, TrendingUp, AlertCircle, ChevronDown, ChevronUp, DollarSign, PieChart, Target, Calculator, BarChart, Users, MapPin } from 'lucide-react';

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

export default function App() {
  // Estado Incomes y Cuota
  const [incomes, setIncomes] = useState([
    { id: 1, name: 'Trabajo Profesor', type: 'empleado', amount: 1500, period: 'mensual', expenses: 0 },
    { id: 2, name: 'Trabajo Artista', type: 'empleado', amount: 750, period: 'mensual', expenses: 0 },
    { id: 3, name: 'Freelance Chipre', type: 'autonomo', amount: 3335, period: 'mensual', expenses: 0 }
  ]);
  const [autonomoQuota, setAutonomoQuota] = useState(478.79); 
  const [autoCalculateQuota, setAutoCalculateQuota] = useState(true);
  const [showOptimization, setShowOptimization] = useState(false);
  const [isMonthlyView, setIsMonthlyView] = useState(false); // Toggle Anual/Mensual

  // Estados Personales IRPF
  const [ccaa, setCcaa] = useState('Comunidad Valenciana');
  const [estadoCivil, setEstadoCivil] = useState('soltero');
  const [hijos, setHijos] = useState(0);

  // --- LÓGICA DE CÁLCULO ---
  const calculations = useMemo(() => {
    let grossAnualTotal = 0;
    let ssEmpleadoAnual = 0;
    let autonomoGrossAnual = 0;
    let autonomoExpensesAnual = 0;

    // Sumar ingresos
    incomes.forEach(inc => {
      const multiplier = inc.period === 'mensual' ? 12 : 1;
      const safeAmount = Number(inc.amount) || 0;
      const safeExpenses = Number(inc.expenses) || 0;
      const anualAmount = safeAmount * multiplier;
      const anualExpenses = safeExpenses * multiplier;

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
    
    const currentTramo = TRAMOS_AUTONOMO.find(t => rendimientoNetoSSMensual >= t.min && rendimientoNetoSSMensual <= t.max) || TRAMOS_AUTONOMO[0];
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

    // 5. Cálculo IRPF progresivo
    const tramosAplicables = CCAA_RATES[ccaa as keyof typeof CCAA_RATES];
    let irpfBreakdown: { rate: number; amount: number; color: string; porcentajeDelBruto: number }[] = [];
    let cuotaIRPF_Total = 0;
    let marginalRate = 0;
    
    let baseRestante = baseImponible;
    let minimoRestante = minimoPersonal;
    let limiteAnterior = 0;

    tramosAplicables.forEach((tramo: { max: number; rate: number }, index: number) => {
      const anchoTramo = tramo.max - limiteAnterior;
      const amountBaseInTramo = Math.max(0, Math.min(baseRestante, anchoTramo));
      const amountMinimoInTramo = Math.max(0, Math.min(minimoRestante, anchoTramo));
      
      const taxInTramo = (amountBaseInTramo * tramo.rate) - (amountMinimoInTramo * tramo.rate);

      if (amountBaseInTramo > 0) {
        cuotaIRPF_Total += taxInTramo;
        marginalRate = tramo.rate;
        irpfBreakdown.push({
          rate: tramo.rate * 100,
          amount: taxInTramo,
          color: IRPF_COLORS[index],
          porcentajeDelBruto: grossAnualTotal > 0 ? (taxInTramo / grossAnualTotal) * 100 : 0
        });
      }

      baseRestante -= amountBaseInTramo;
      minimoRestante -= amountMinimoInTramo;
      limiteAnterior = tramo.max;
    });

    cuotaIRPF_Total = Math.max(0, cuotaIRPF_Total);
    const ssTotalAnual = ssEmpleadoAnual + ssAutonomoAnual;
    const netAnual = grossAnualTotal - ssTotalAnual - cuotaIRPF_Total - autonomoExpensesAnual;

    // Datos Gráfico Macro
    const chartSegments = [
      { id: 'gastos', label: 'Gastos Actividad', amount: autonomoExpensesAnual, color: 'bg-slate-500', porc: (autonomoExpensesAnual/grossAnualTotal)*100 },
      { id: 'ss', label: 'Seguridad Social', amount: ssTotalAnual, color: 'bg-amber-500', porc: (ssTotalAnual/grossAnualTotal)*100 },
      ...irpfBreakdown.map(t => ({ id: `irpf_${t.rate}`, label: `IRPF (${t.rate}%)`, amount: t.amount, color: t.color, porc: t.porcentajeDelBruto })),
      { id: 'neto', label: 'Neto Limpio', amount: netAnual, color: 'bg-indigo-500', porc: (netAnual/grossAnualTotal)*100 }
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
      porcNeto: grossAnualTotal > 0 ? (netAnual / grossAnualTotal) * 100 : 0,
      porcSS: grossAnualTotal > 0 ? (ssTotalAnual / grossAnualTotal) * 100 : 0,
      porcIRPF: grossAnualTotal > 0 ? (cuotaIRPF_Total / grossAnualTotal) * 100 : 0
    };
  }, [incomes, autonomoQuota, autoCalculateQuota, ccaa, estadoCivil, hijos]);

  const addIncome = () => setIncomes([...incomes, { id: Date.now(), name: 'Nuevo Ingreso', type: 'empleado', amount: 1000, period: 'mensual', expenses: 0 }]);
  
  const updateIncome = (id: number, field: string, value: string) => {
    setIncomes(incomes.map(inc => {
      if (inc.id !== id) return inc;
      if (field === 'name' || field === 'type' || field === 'period') return { ...inc, [field]: value };

      let parsedValue: number | string = value === '' ? '' : Number(value);
      if (typeof parsedValue === 'number' && Number.isNaN(parsedValue)) parsedValue = 0;
      return { ...inc, [field]: parsedValue };
    }));
  };

  const removeIncome = (id: number) => setIncomes(incomes.filter(inc => inc.id !== id));
  const formatCurrency = (num: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(num);

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
          {/* Header Superior: Titulillo y Toggle */}
          <div className="flex justify-between items-center mb-3">
             <div className="flex items-center gap-1.5 text-indigo-600">
               <Target size={16} />
               <span className="text-xs font-bold uppercase tracking-widest">Simulador Fiscal</span>
             </div>
             
             {/* Toggle Anual/Mensual */}
             <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
                <button 
                  onClick={() => setIsMonthlyView(false)}
                  className={`text-xs font-semibold px-3 py-1 rounded-md transition-colors ${!isMonthlyView ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Anual
                </button>
                <button 
                  onClick={() => setIsMonthlyView(true)}
                  className={`text-xs font-semibold px-3 py-1 rounded-md transition-colors ${isMonthlyView ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Mensual
                </button>
             </div>
          </div>

          {/* Fila de Métricas */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            
            {/* Izquierda: Bruto y Neto */}
            <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto justify-between md:justify-start">
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-0.5">Bruto</p>
                <p className="text-2xl md:text-3xl font-black text-slate-800 leading-none">{formatCurrency(displayGross)}</p>
              </div>
              <div className="h-10 w-px bg-slate-200 hidden md:block"></div>
              <div className="text-right md:text-left">
                <p className="text-xs text-indigo-600 font-bold uppercase tracking-wider mb-0.5 flex items-center justify-end md:justify-start gap-2">
                  Neto
                  {calculations.grossAnualTotal > 0 && <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-[10px]">{calculations.porcNeto.toFixed(1)}%</span>}
                </p>
                <p className="text-3xl md:text-4xl font-black text-indigo-600 leading-none">{formatCurrency(displayNet)}</p>
              </div>
            </div>
            
            {/* Derecha: SS e IRPF */}
            <div className="flex gap-6 w-full md:w-auto justify-between md:justify-end border-t border-slate-100 md:border-0 pt-3 md:pt-0">
              <div>
                <span className="text-slate-500 flex items-center gap-1 text-xs font-semibold uppercase">
                  Seg. Social
                  {calculations.grossAnualTotal > 0 && <span className="text-amber-500">({calculations.porcSS.toFixed(1)}%)</span>}
                </span>
                <span className="font-bold text-amber-600 text-lg leading-none">-{formatCurrency(displaySS)}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-500 flex items-center justify-end gap-1 text-xs font-semibold uppercase">
                  IRPF Medio
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
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* COLUMNA IZQUIERDA: INPUTS */}
            <div className="lg:col-span-5 space-y-4">
              
              {/* Panel Perfil Personal */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <h2 className="text-lg font-semibold flex items-center gap-2 mb-4 text-slate-800">
                  <Users size={20} className="text-indigo-500"/> Perfil Personal (IRPF)
                </h2>
                <div className="space-y-3 text-sm">
                  <div>
                    <label className="font-medium text-slate-500 mb-1 flex items-center gap-1"><MapPin size={14}/> Com. Autónoma</label>
                    <select value={ccaa} onChange={(e) => setCcaa(e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500">
                      {Object.keys(CCAA_RATES).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-medium text-slate-500 mb-1 block">Estado Civil</label>
                      <select value={estadoCivil} onChange={(e) => setEstadoCivil(e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="soltero">Soltero/a</option>
                        <option value="casado_indiv">Casado (Indiv)</option>
                        <option value="casado_conjunta">Casado (Conjunta)</option>
                      </select>
                    </div>
                    <div>
                      <label className="font-medium text-slate-500 mb-1 block">Hijos a cargo</label>
                      <select value={hijos} onChange={(e) => setHijos(Number(e.target.value))} className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="0">Ninguno</option>
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="4">4 o más</option>
                      </select>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-indigo-600 font-medium p-2 bg-indigo-50 rounded-lg border border-indigo-100">
                    Mínimo Personal exento aplicado: {formatCurrency(calculations.minimoPersonal)}
                  </div>
                </div>
              </div>

              {/* Panel Ingresos */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <DollarSign size={20} className="text-emerald-500"/> Ingresos
                  </h2>
                  <button onClick={addIncome} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1.5 font-medium rounded-md flex items-center gap-1 hover:bg-indigo-100 transition-colors">
                    <PlusCircle size={14} /> Añadir
                  </button>
                </div>

                <div className="space-y-4">
                  {incomes.map((inc) => (
                    <div key={inc.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 relative group text-sm">
                      <button onClick={() => removeIncome(inc.id)} className="absolute top-2 right-2 text-slate-400 hover:text-red-500">
                        <Trash2 size={14} />
                      </button>
                      
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <input type="text" value={inc.name} onChange={(e) => updateIncome(inc.id, 'name', e.target.value)} className="w-full p-1.5 border border-slate-200 rounded bg-white" placeholder="Nombre"/>
                        <select value={inc.type} onChange={(e) => updateIncome(inc.id, 'type', e.target.value)} className="w-full p-1.5 border border-slate-200 rounded bg-white">
                          <option value="empleado">Cuenta Ajena</option>
                          <option value="autonomo">Freelance</option>
                        </select>
                      </div>

                      <div className="mb-2">
                        <label className="text-xs font-medium text-slate-500">Ingreso {inc.period}</label>
                        <div className="flex items-center gap-2 mt-1">
                          <input type="range" min="0" max={10000} step="50" value={inc.amount} onChange={(e) => updateIncome(inc.id, 'amount', e.target.value)} className="flex-1 accent-indigo-600"/>
                          <input type="number" value={inc.amount} onChange={(e) => updateIncome(inc.id, 'amount', e.target.value)} className="w-20 p-1 border border-slate-300 rounded font-medium text-slate-700"/>
                        </div>
                      </div>

                      {inc.type === 'autonomo' && (
                        <div className="pt-2 border-t border-slate-200">
                          <label className="text-xs font-medium text-orange-600">Gastos Deducibles {inc.period}</label>
                          <div className="flex items-center gap-2 mt-1">
                            <input type="range" min="0" max={Number(inc.amount) || 1000} step="10" value={inc.expenses} onChange={(e) => updateIncome(inc.id, 'expenses', e.target.value)} className="flex-1 accent-orange-500"/>
                            <input type="number" value={inc.expenses} onChange={(e) => updateIncome(inc.id, 'expenses', e.target.value)} className="w-20 p-1 border border-slate-300 rounded font-medium text-slate-700"/>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Panel Cuota & Optimización */}
              {calculations.hasAutonomo && (
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2"><PieChart size={18} className="text-blue-500"/> Cuota Autónomo</h2>
                    <label className="flex items-center cursor-pointer">
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
                    <span className="text-sm text-slate-500">€/mes a Seg. Social</span>
                  </div>
                  {autoCalculateQuota && (
                     <p className="text-xs text-indigo-500 font-medium mb-4 flex items-center gap-1">
                       <Calculator size={12} /> Calculado según Tramo {calculations.currentTramo.id}
                     </p>
                  )}

                  {/* SECCIÓN DESPLEGABLE DE OPTIMIZACIÓN */}
                  <div className="border-t border-slate-100 pt-3 mt-4">
                    <button 
                      onClick={() => setShowOptimization(!showOptimization)}
                      className="w-full flex items-center justify-between text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors"
                    >
                      <span className="flex items-center gap-2"><TrendingUp size={16}/> Optimización de cuota</span>
                      {showOptimization ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                    </button>

                    {showOptimization && (
                      <div className="mt-4 space-y-4">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                          <p className="text-sm text-slate-600 mb-4">
                            Rendimiento computable: <strong>{formatCurrency(calculations.rendimientoNetoSSMensual)}/mes</strong>. 
                            Estás en el <strong>Tramo {calculations.currentTramo.id}</strong> ({formatCurrency(calculations.currentTramo.min)} - {calculations.currentTramo.max === Infinity ? 'Max' : formatCurrency(calculations.currentTramo.max)}).
                          </p>

                          <div className="relative h-6 bg-slate-200 rounded-full overflow-hidden mb-2">
                             <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-400 to-indigo-500"
                                  style={{ width: calculations.currentTramo.max !== Infinity ? `${((calculations.rendimientoNetoSSMensual - calculations.currentTramo.min) / (calculations.currentTramo.max - calculations.currentTramo.min)) * 100}%` : '50%' }}
                             />
                          </div>
                          
                          <div className="flex justify-between text-xs text-slate-400 font-bold">
                            <span>{formatCurrency(calculations.currentTramo.min)}</span>
                            <span>{calculations.currentTramo.max === Infinity ? '+ Infinito' : formatCurrency(calculations.currentTramo.max)}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                            <p className="text-xs text-emerald-600 font-bold mb-1 flex items-center gap-1"><ChevronDown size={14}/> Bajar de tramo</p>
                            <p className="text-xs text-slate-600 leading-tight">Justifica <strong>{formatCurrency(distanceToPrevTramo)}/mes</strong> extra en gastos.</p>
                          </div>
                          <div className="bg-amber-50 p-3 rounded-xl border border-amber-100">
                            <p className="text-xs text-amber-600 font-bold mb-1 flex items-center gap-1"><ChevronUp size={14}/> Margen ganancia</p>
                            <p className="text-xs text-slate-600 leading-tight">Puedes ganar <strong>{calculations.currentTramo.max === Infinity ? 'Ilimitado' : formatCurrency(distanceToNextTramo)}/mes</strong> extra sin subir cuota.</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* COLUMNA DERECHA: RESULTADOS */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* GRÁFICO TOTAL DEL BRUTO */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                 <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <BarChart size={20} className="text-blue-500"/> A dónde va cada Euro de tu Bruto Total
                </h3>
                
                {calculations.grossAnualTotal > 0 ? (
                  <>
                    <div className="w-full h-12 flex rounded-xl overflow-hidden border border-slate-200 shadow-inner mb-6">
                      {calculations.chartSegments.map((seg, i) => seg.amount > 0 && (
                        <div key={i} className={`h-full ${seg.color} transition-all duration-500 flex items-center justify-center border-r border-white/20 last:border-0 hover:brightness-110 cursor-default group relative`} style={{ width: `${seg.porc}%` }}>
                          {seg.porc > 8 && <span className="text-xs font-bold text-white/90 truncate px-1">{seg.label}</span>}
                          {/* Tooltip on hover */}
                          <div className="absolute -top-10 scale-0 group-hover:scale-100 transition-transform bg-slate-800 text-white text-xs py-1 px-2 rounded z-10 whitespace-nowrap">
                            {seg.label}: {formatCurrency(seg.amount)} ({(seg.porc).toFixed(1)}%)
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {calculations.chartSegments.filter(s => s.amount > 0).map((seg, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <div className={`w-3 h-3 rounded-full ${seg.color} shrink-0`}></div>
                          <div className="overflow-hidden">
                            <p className="font-medium text-slate-700 truncate text-xs">{seg.label}</p>
                            <p className="text-xs text-slate-500 font-semibold">{formatCurrency(seg.amount)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center p-6 text-slate-400 bg-slate-50 rounded-xl border border-slate-100">Introduce ingresos para ver el desglose</div>
                )}
              </div>

              {/* Insights */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                 <h3 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2"><Info size={18} className="text-blue-500"/> Información Técnica</h3>
                 
                 <div className="space-y-4">
                    <div className="flex gap-3 text-sm text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <AlertCircle className="shrink-0 text-slate-400" size={18} />
                      <p>
                        Calculado restando automáticamente el <strong>5% de gastos de difícil justificación</strong> sobre rendimientos de IRPF (tope 2.000€) y el <strong>7%</strong> para el cómputo del tramo de la Seguridad Social.
                      </p>
                    </div>
                    
                    <div className="flex gap-3 text-sm text-indigo-700 bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                      <Target className="shrink-0 text-indigo-500" size={18} />
                      <div>
                        <p className="font-bold mb-1">Tipo Marginal Actual: {(calculations.marginalRate * 100).toFixed(1)}%</p>
                        <p className="text-indigo-600">De cada 100€ extras que ganes ahora, Hacienda retendrá {(calculations.marginalRate * 100).toFixed(1)}€. Y por cada 100€ que logres deducir, te ahorrarás esa misma cantidad en tu Declaración.</p>
                      </div>
                    </div>
                 </div>
              </div>

            </div>
          </div>
          
          {/* FOOTER */}
          <footer className="mt-8 text-center text-xs font-medium text-slate-400 py-6 border-t border-slate-200">
            developed by anderwien
          </footer>

        </div>
      </div>
    </div>
  );
}